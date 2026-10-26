import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 native flat config export karta hai (array).
 * Pehle FlatCompat + `compat.extends("next/core-web-vitals")` use hota tha —
 * wo eslint 9.39 par "Converting circular structure to JSON" se crash karta
 * tha (matlab lint kabhi chalta hi nahi tha), isliye direct flat config.
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "src/data/catalog.json", "next-env.d.ts"],
    rules: {
      /**
       * Cart/wishlist/compare/settings localStorage me rehte hain. Server par wo
       * nahi hote, isliye mount ke baad effect me padhna hi sahi tareeka hai
       * (warna hydration mismatch). Rule error se warning kiya — asli bug nahi
       * hai, par naya galti se likha gaya cascade pakadne ke liye warning
       * rehne dete hain.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default config;
