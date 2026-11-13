-- ARKEN PAY · esquema de la base de datos en la nube (Supabase / PostgreSQL 15+)
--
-- Se ejecuta UNA vez, en el «SQL Editor» del proyecto de Supabase. Crea:
--   · la tabla arken_pay_eventos, la bitácora de todo lo que pasa en ARKEN PAY;
--   · un disparador que impide modificar o borrar eventos (ni siquiera el dueño de la base desde la
--     API: solo quedaría el acceso directo de superusuario, que deja rastro en Supabase);
--   · la función arken_pay_agregar_evento, la ÚNICA forma de escribir: verifica dentro de una
--     transacción que el evento sea el siguiente número y enlace con el hash del anterior;
--   · seguridad por filas (RLS): solo los usuarios autenticados del proyecto leen, nadie escribe
--     directo en la tabla.
-- Es seguro ejecutarlo de nuevo: no borra datos.

create table if not exists public.arken_pay_eventos (
  seq         bigint      primary key check (seq > 0),
  id          text        not null unique,
  tipo        text        not null,
  fecha       text        not null,          -- texto ISO tal cual lo selló el programa (entra en el hash)
  usuario     text        not null,
  datos       jsonb       not null,
  hash_previo text        not null,
  hash        text        not null unique check (hash ~ '^[0-9a-f]{64}$'),
  recibido    timestamptz not null default now(),
  autor       uuid        not null default auth.uid()
);

comment on table public.arken_pay_eventos is 'ARKEN PAY: bitácora inmutable de eventos (facturas, notas, recaudos, usuarios...). No admite cambios ni borrados.';

-- Inmutabilidad
create or replace function public.arken_pay_bloquear_cambios() returns trigger
language plpgsql as $$
begin
  raise exception 'La bitácora de ARKEN PAY no admite cambios ni borrados. Corrija con un evento nuevo (nota, reversión).';
end $$;

drop trigger if exists arken_pay_sin_cambios on public.arken_pay_eventos;
create trigger arken_pay_sin_cambios before update or delete on public.arken_pay_eventos
  for each row execute function public.arken_pay_bloquear_cambios();

drop trigger if exists arken_pay_sin_vaciar on public.arken_pay_eventos;
create trigger arken_pay_sin_vaciar before truncate on public.arken_pay_eventos
  for each statement execute function public.arken_pay_bloquear_cambios();

-- Escritura controlada
create or replace function public.arken_pay_agregar_evento(
  p_seq bigint, p_id text, p_tipo text, p_fecha text, p_usuario text, p_datos jsonb, p_hash_previo text, p_hash text
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ultimo_seq  bigint;
  v_ultimo_hash text;
begin
  if auth.uid() is null then
    raise exception 'ARKEN_PAY_SIN_SESION: inicie sesión.';
  end if;
  -- Un escritor a la vez: los demás esperan y luego ven el número actualizado
  perform pg_advisory_xact_lock(hashtext('arken_pay_eventos'));
  select seq, hash into v_ultimo_seq, v_ultimo_hash from public.arken_pay_eventos order by seq desc limit 1;
  v_ultimo_seq  := coalesce(v_ultimo_seq, 0);
  v_ultimo_hash := coalesce(v_ultimo_hash, '');
  if p_seq <> v_ultimo_seq + 1 or p_hash_previo <> v_ultimo_hash then
    raise exception 'ARKEN_PAY_CONFLICTO: otro usuario registró algo primero (último %).', v_ultimo_seq
      using errcode = '40001';
  end if;
  insert into public.arken_pay_eventos (seq, id, tipo, fecha, usuario, datos, hash_previo, hash)
    values (p_seq, p_id, p_tipo, p_fecha, p_usuario, p_datos, p_hash_previo, p_hash);
  return p_seq;
end $$;

-- Seguridad por filas
alter table public.arken_pay_eventos enable row level security;

drop policy if exists arken_pay_leer on public.arken_pay_eventos;
create policy arken_pay_leer on public.arken_pay_eventos for select to authenticated using (true);
-- Sin políticas de insert/update/delete: nadie escribe directo, solo con la función.

revoke all on public.arken_pay_eventos from anon;
revoke insert, update, delete, truncate on public.arken_pay_eventos from authenticated;
grant select on public.arken_pay_eventos to authenticated;
revoke all on function public.arken_pay_agregar_evento(bigint, text, text, text, text, jsonb, text, text) from public, anon;
grant execute on function public.arken_pay_agregar_evento(bigint, text, text, text, text, jsonb, text, text) to authenticated;

-- Documentos soporte (XML y PDF de facturas y notas), guardados por su hash SHA-256.
-- Solo se agregan: no se modifican ni se borran. El hash se verifica en la base.
create table if not exists public.arken_pay_documentos (
  hash      text        primary key check (hash ~ '^[0-9a-f]{64}$'),
  nombre    text        not null default '',
  contenido text        not null,                 -- base64
  recibido  timestamptz not null default now(),
  autor     uuid        not null default auth.uid()
);

create or replace function public.arken_pay_verificar_documento() returns trigger
language plpgsql set search_path = public as $$
begin
  if encode(sha256(decode(new.contenido, 'base64')), 'hex') <> new.hash then
    raise exception 'El documento no corresponde a su hash.';
  end if;
  if octet_length(new.contenido) > 21000000 then
    raise exception 'El documento supera 15 MB.';
  end if;
  return new;
end $$;

drop trigger if exists arken_pay_doc_hash on public.arken_pay_documentos;
create trigger arken_pay_doc_hash before insert on public.arken_pay_documentos
  for each row execute function public.arken_pay_verificar_documento();
drop trigger if exists arken_pay_doc_sin_cambios on public.arken_pay_documentos;
create trigger arken_pay_doc_sin_cambios before update or delete on public.arken_pay_documentos
  for each row execute function public.arken_pay_bloquear_cambios();

alter table public.arken_pay_documentos enable row level security;
drop policy if exists arken_pay_doc_leer on public.arken_pay_documentos;
create policy arken_pay_doc_leer on public.arken_pay_documentos for select to authenticated using (true);
drop policy if exists arken_pay_doc_agregar on public.arken_pay_documentos;
create policy arken_pay_doc_agregar on public.arken_pay_documentos for insert to authenticated with check (true);
revoke all on public.arken_pay_documentos from anon;
revoke update, delete, truncate on public.arken_pay_documentos from authenticated;
grant select, insert on public.arken_pay_documentos to authenticated;
