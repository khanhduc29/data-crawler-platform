import mongoose from "mongoose";

const CrawlProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

    tool: {
      type: String,
      required: true,
      enum: ["google-map", "tiktok", "twitter", "youtube", "instagram", "pinterest"],
    },

    keyword: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      default: "",
    },

    total_collected: {
      type: Number,
      default: 0,
    },

    last_task_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique: cùng user + tool + keyword + address = 1 progress record
CrawlProgressSchema.index(
  { userId: 1, tool: 1, keyword: 1, address: 1 },
  { unique: true }
);

export default mongoose.model("CrawlProgress", CrawlProgressSchema);
