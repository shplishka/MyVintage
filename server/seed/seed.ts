import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Post from '../src/models/Post';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

interface SeedUser {
  _id: string;
  username: string;
  email: string;
  password: string;
  authProvider: string;
  biography?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  itemsSold?: number;
  savedPosts?: string[];
}

interface SeedPost {
  seller: string;
  title: string;
  description: string;
  category: string;
  price: number;
  condition: string;
  year: number;
  brand: string;
  style: string;
  images: string[];
  status: string;
}

interface SeedData {
  users: SeedUser[];
  posts: SeedPost[];
}

async function seed() {
  const dbUri = process.env.DATABASE_URL;
  if (!dbUri) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  await mongoose.connect(dbUri);
  console.log('Connected to MongoDB');

  const dataPath = path.resolve(__dirname, 'seed-data.json');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data: SeedData = JSON.parse(raw);

  const existingPosts = await Post.countDocuments();

  if (existingPosts > 0) {
    console.log(`DB already has ${existingPosts} posts. Skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  for (const u of data.users) {
    const existing = await User.findOne({ email: u.email });
    if (existing) {
      console.log(`User "${u.username}" already exists — reusing`);
      u._id = existing._id.toString();
      continue;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(u.password, salt);

    const created = await User.create({
      _id: new mongoose.Types.ObjectId(u._id),
      username: u.username,
      email: u.email,
      password: hashedPassword,
      authProvider: u.authProvider,
      biography: u.biography,
      location: u.location,
      rating: u.rating ?? 0,
      reviewCount: u.reviewCount ?? 0,
      itemsSold: u.itemsSold ?? 0,
      savedPosts: u.savedPosts ?? [],
    });
    u._id = created._id.toString();
    console.log(`Created user: ${u.username}`);
  }

  const userIdMap = new Map(data.users.map((u) => [u._id, u._id]));

  const seedImagesDir = path.resolve(__dirname, 'images');
  const publicDir = path.resolve(__dirname, '..', 'public', 'posts');

  for (const p of data.posts) {
    const sellerId = userIdMap.get(p.seller) ?? p.seller;
    const created = await Post.create({
      seller: new mongoose.Types.ObjectId(sellerId),
      title: p.title,
      description: p.description,
      category: p.category,
      price: p.price,
      condition: p.condition,
      year: p.year,
      brand: p.brand,
      style: p.style,
      images: [],
      status: p.status,
    });

    const postId = created._id.toString();
    const mediaPaths: string[] = [];

    for (const seedFilename of p.images) {
      const srcPath = path.join(seedImagesDir, seedFilename);
      if (!fs.existsSync(srcPath)) {
        console.warn(`Image not found: ${seedFilename} — skipping`);
        continue;
      }

      const parts = seedFilename.split('_');
      const imageFilename = parts.slice(1).join('_');
      const destDir = path.join(publicDir, postId);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcPath, path.join(destDir, imageFilename));

      mediaPaths.push(`/media/posts/${postId}/${imageFilename}`);
    }

    if (mediaPaths.length > 0) {
      await Post.updateOne({ _id: created._id }, { images: mediaPaths });
    }

    console.log(`Created post: "${p.title}" (${mediaPaths.length} images)`);
  }
  console.log(`Inserted ${data.posts.length} posts`);

  await mongoose.disconnect();
  console.log('Seed complete');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
