import { createHealthPayload } from "@forge/core";
import { Hono } from "hono";

export const app = new Hono();

app.get("/health", (c) => c.json(createHealthPayload()));
