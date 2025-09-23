export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: "7d"
};
export const allowedEmailDomain = process.env.ALLOWED_EMAIL_DOMAIN || "innovation.group";
