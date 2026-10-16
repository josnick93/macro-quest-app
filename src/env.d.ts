interface ImportMetaEnv {
  /** ID de editor de AdSense (ca-pub-…). Sin él no hay anuncios. */
  readonly VITE_ADSENSE_CLIENT?: string;
  /** ID del bloque de anuncios del banner. */
  readonly VITE_ADSENSE_SLOT?: string;
  /** Página de donación (Ko-fi…). Sin ella no sale el enlace en Perfil. */
  readonly VITE_DONATE_URL?: string;
}
