// src/types/telegraf.d.ts  (TypeScript augmentation)
import "telegraf";
declare module "telegraf" {
  interface Context {
    state: {
      sid: string;
      // add other shared deps here later
    };
  }
}
