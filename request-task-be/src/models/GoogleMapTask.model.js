import mongoose from "mongoose";

const GoogleMapTaskSchema = new mongoose.Schema(
  {
    job_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoogleMapJob",
      required: true,
    },

    keyword: {
      type: String,
      required: true,
    },

    address: {
      type: String,
      required: true,
    },

    region: {
      type: String,
      required: true,
    },

    result_limit: {
      type: Number,
      required: true,
    },

    delay_seconds: {
      type: Number,
      required: true,
    },

    deep_scan: {
      type: Boolean,
      default: false,
    },

    deep_scan_website: {
      type: Boolean,
      default: false,
    },

    deep_scan_reviews: {
      type: Boolean,
      default: false,
    },

    review_limit: {
      type: Number,
      default: 20,
    },

    review_filter_stars: {
      type: [Number],
      default: [],
    },

    status: {
      type: String,
      enum: ["pending", "processing", "success", "error"],
      default: "pending",
    },

    result: {
      type: mongoose.Schema.Types.Mixed, // Place[]
      default: null,
    },

    partial_result: {
      type: mongoose.Schema.Types.Mixed, // Place[] (kết quả tạm)
      default: null,
    },

    error_message: String,

    assigned_worker: {
      type: String,
      default: null,
      index: true,
    },

    skip_count: { type: Number, default: 0 },

    retry_count: { type: Number, default: 0 },
    max_retries: { type: Number, default: 3 },
    last_error: { type: String, default: null },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("GoogleMapTask", GoogleMapTaskSchema);