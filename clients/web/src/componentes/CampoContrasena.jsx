import React, { useState } from 'react';

/**
 * Campo de contrasena con boton para mostrarla u ocultarla (el "ojo" de los
 * formularios habituales). Accesible: el boton anuncia su estado con
 * aria-pressed y su nombre cambia ("Mostrar contraseña" / "Ocultar
 * contraseña"); no recibe el foco al enviar con Enter porque es type="button".
 */
export default function CampoContrasena({ id, value, onChange, className = '', ...resto }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className={`w-full bg-superficie border border-gray-300 rounded-lg pl-3 pr-11 py-2 ${className}`}
        {...resto}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-controls={id}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-gray-500 hover:text-gray-800 rounded-r-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-marca-500"
      >
        {visible ? (
          // Ojo tachado
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          // Ojo
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
