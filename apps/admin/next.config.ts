import type { NextConfig } from 'next';

// Console 100 % côté navigateur : exportée en fichiers statiques (dossier out/),
// hébergeable sur n'importe quel serveur web ou CDN. Elle parle à l'API via NEXT_PUBLIC_API_URL.
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default config;
