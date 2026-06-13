import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

/**
 * NextAuth configuration for HERMÈS
 *
 * Uses a Credentials provider with a single demo account.
 * JWT session strategy — no database adapter needed.
 * Easily extensible: add OAuth providers (GitHub, Google, etc.) here.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Demo Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "demo@hermes.app" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Demo account — matches immediately without a DB lookup
        if (
          credentials?.email === "demo@hermes.app" &&
          credentials?.password === "hermes2024"
        ) {
          return {
            id: "usr_demo_001",
            name: "Demo User",
            email: "demo@hermes.app",
            image: null,
          };
        }
        // Return null to signal "invalid credentials"
        return null;
      },
    }),
  ],

  session: {
    strategy: "jwt",
    // Session expires in 24 h
    maxAge: 24 * 60 * 60,
  },

  jwt: {
    // Use NEXTAUTH_SECRET from env; fall back to a stable dev secret
    secret: process.env.NEXTAUTH_SECRET ?? "hermes-dev-secret-change-in-production",
  },

  secret: process.env.NEXTAUTH_SECRET ?? "hermes-dev-secret-change-in-production",

  pages: {
    // Custom sign-in page (we'll create this later if needed)
    // signIn: "/login",
  },

  callbacks: {
    /**
     * Include user id in the JWT token so it's available in session.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },

    /**
     * Expose user id on the session object for client & server use.
     */
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === "development",
};
