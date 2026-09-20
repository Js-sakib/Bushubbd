   import { MongoClient, Db } from "mongodb";

   let cachedClient: MongoClient | null = null;
   let cachedDb: Db | null = null;

   export async function connectToDatabase() {
     if (cachedDb) {
       return { client: cachedClient, db: cachedDb };
     }

     const client = new MongoClient(process.env.MONGODB_URI!);
     await client.connect();

     const db = client.db("bushubbd");

     // Create collections if don't exist
     const collections = await db.listCollections().toArray();
     const collectionNames = collections.map(c => c.name);

     if (!collectionNames.includes("buses")) {
       await db.createCollection("buses");
     }
     if (!collectionNames.includes("bookings")) {
       await db.createCollection("bookings");
     }
     if (!collectionNames.includes("companies")) {
       await db.createCollection("companies");
     }
     if (!collectionNames.includes("payments")) {
       await db.createCollection("payments");
     }
     if (!collectionNames.includes("sessions")) {
       await db.createCollection("sessions");
     }

     cachedClient = client;
     cachedDb = db;

     return { client, db };
   }
