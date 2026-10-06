package com.aboteroproyectos.arkenprecios;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Pantalla completa de borde a borde en todas las versiones de Android: el programa
        // ya respeta las zonas de la barra de estado y de navegación (safe-area).
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
