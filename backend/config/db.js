import mongoose from "mongoose";
import { MongoMemoryServer } from 'mongodb-memory-server';

const connectDB = async () => {
  try {
    let uri = process.env.MONGO_URI;
    
    // Automatically spin up in-memory DB if a default template URI is found
    if (!uri || uri.includes("username:password")) {
      console.log("⚠️ No valid MongoDB URI provided. Starting In-Memory MongoDB Server...");
      const mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`✅ In-Memory MongoDB Started at ${uri}`);
    }

    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
