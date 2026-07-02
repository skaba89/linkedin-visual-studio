import "next-auth";

declare module "next-auth" {
  /**
   * Extended session user with id from JWT callback.
   */
  interface Session {
    user: {
      /** User id — sourced from the JWT token */
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    /** Persisted in the JWT via the jwt() callback */
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** User id carried through the JWT */
    id?: string;
  }
}
