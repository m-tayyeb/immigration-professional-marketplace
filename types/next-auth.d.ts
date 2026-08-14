import "next-auth";

declare module "next-auth" {
  interface User {
    role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
  }
  interface Session {
    user: {
      id: string;
      role: "CLIENT" | "PROFESSIONAL" | "ADMIN";
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
