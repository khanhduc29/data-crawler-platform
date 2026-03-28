// import { Place } from "./place";

// export type CrawlTask = {
//   id: string;
//   job_id: string;
//   keyword: string;
//   address: string;
//   region: string;
//   result_limit: number;
//   delay_seconds: number;
//   deep_scan: boolean;
//   deep_scan_website: boolean;
//   status: "pending" | "processing" | "success" | "error";
//   result?: Place[];
//   error_message?: string;
//   created_at: string;
// };
import { Place } from "./place";

export type CrawlTask = {
  _id: string;                 // ✅ MongoDB ObjectId
  job_id: string;

  keyword: string;
  address: string;
  region: string;

  result_limit: number;
  delay_seconds: number;

  deep_scan: boolean;
  deep_scan_website: boolean;
  deep_scan_reviews: boolean;
  review_limit: number;
  review_filter_stars: number[];

  status: "pending" | "processing" | "success" | "error";

  result?: Place[];
  error_message?: string;
  skip_count?: number;

  created_at: string;
  updated_at?: string;         // ✅ thêm cho đầy đủ
};