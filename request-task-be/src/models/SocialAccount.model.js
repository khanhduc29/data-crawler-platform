import mongoose from "mongoose";

const SocialAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    platform: {
      type: String,
      enum: ["twitter", "tiktok", "instagram", "youtube", "pinterest", "facebook"],
      required: true,
    },

    label: {
      type: String,
      default: "",
    },

    username: {
      type: String,
      default: "",
    },

    password: {
      type: String,
      default: "",
    },

    cookies: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive", "banned", "expired"],
      default: "active",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Unique constraint: same username on same platform
SocialAccountSchema.index({ platform: 1, username: 1 }, { unique: true });

export default mongoose.model("SocialAccount", SocialAccountSchema);
