/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // ── Paleta ODONTOVAL ───────────────────────────────────────
      // brand = Verde Bosque (primario de marca)
      colors: {
        brand: {
          50:  '#ECFDF5',
          100: '#D8F3DC',  // Verde Pálido
          200: '#95D5B2',  // Verde Menta
          300: '#52B788',  // Verde Esmeralda
          400: '#3a9166',
          500: '#2D6A4F',  // Verde Bosque – color principal
          600: '#256040',
          700: '#1e5236',
          800: '#163d28',
          900: '#0e291a',
        },
        // azul = Azul Confianza (acento secundario)
        azul: {
          50:  '#EFF6FF',
          100: '#BFD7ED',  // Azul Hielo
          200: '#BFD7ED',
          300: '#2E7EC1',  // Azul Cielo
          500: '#1A4F8A',  // Azul Confianza
          600: '#1A4F8A',
          700: '#143d6b',
          800: '#0e2b4e',
        },
        // cafe = Café Raíz (terciario cálido)
        cafe: {
          100: '#F0EDE8',  // Arena Cálida
          300: '#c89a79',
          500: '#7B4B2A',  // Café Raíz
          700: '#5c3720',
        },
        // neutros de marca
        crema: '#FAFAF8',
        arena: '#F0EDE8',
        tierra: '#7A7368',
        suelo:  '#2E2A24',
      },
      // ── Tipografía ────────────────────────────────────────────
      fontFamily: {
        sans:    ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      // ── Sombras sutiles ───────────────────────────────────────
      boxShadow: {
        card: '0 1px 4px 0 rgba(45,106,79,0.08)',
      },
    },
  },
  plugins: [],
}
