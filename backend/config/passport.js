import dotenv from "dotenv";
dotenv.config();
console.log("PASSPORT CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: 'https://streakboard.onrender.com/api/auth/google/callback',
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();
        const avatar = profile.photos?.[0]?.value || "";
        const name = profile.displayName || email?.split("@")[0] || "User";

        // 1. Try to find by googleId
        let user = await User.findOne({ googleId: profile.id });

        if (!user && email) {
          // 2. Try to find existing account by email (merge accounts)
          user = await User.findOne({ email });
        }

        if (user) {
          // Update googleId and avatar if missing
          if (!user.googleId) user.googleId = profile.id;
          if (!user.avatar && avatar) user.avatar = avatar;
          await user.save();
        } else {
          // 3. Create a brand-new user
          user = await User.create({
            googleId: profile.id,
            email,
            name,
            avatar,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Sessions are not used — JWT only. These stubs satisfy Passport's interface.
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
