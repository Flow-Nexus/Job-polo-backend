import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "./generated/prisma/index.js";
import authRoutes from "./routes/authRoutes.js";
// import { createServer } from "http";
// import { Server } from "socket.io";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 6800;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
prisma
  .$connect()
  .then(() => {
    console.log("🗄️  Connected to the MySQL database successfully.");
  })
  .catch((e) => {
    console.error("Failed to connect to the MySQL database:", e);
  });

//Routes
app.use("/api/v1/auth", authRoutes);

// Local dev server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

// Export app for Vercel
export default app;

// // Socket.IO Setup
// io.on("connection", (socket) => {
//   console.log(`User connected: ${socket.id}`);

//   socket.on("disconnect", () => {
//     console.log(`User disconnected: ${socket.id}`);
//   });
// });

// // Start server after confirming DB connection
// if (process.env.NODE_ENV !== "production") {
//   app.listen(PORT, () => {
//     console.log(`🚀 Server running on http://localhost:${PORT}`);
//     console.log(`🌐 WebSocket running on ws://localhost:${PORT}`);
//   });
// }

// export default { app, io };
