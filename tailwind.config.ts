import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './resources/views/**/*.edge',
    './resources/js/**/*.{js,ts,jsx,tsx}',
    './start/**/*.ts',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
