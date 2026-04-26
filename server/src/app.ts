import express, { Application } from 'express';
import cors from 'cors';
import dotenv from "dotenv";
import path from "path";
import swaggerUi from 'swagger-ui-express';
import connectDB from './services/db';
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import userRoutes from './routes/user.routes';
import commentRoutes from './routes/comment.routes';
import offerRoutes from './routes/offer.routes';
import transactionRoutes from './routes/transaction.routes';
import swaggerSpec from './config/swagger';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
// process.cwd() is the server/ directory when PM2/node starts the app from there.
// __dirname would resolve to dist/src after compilation and point at the wrong folder.
app.use('/media', express.static(path.join(process.cwd(), 'public')));
app.use('/api/auth', authRoutes);
app.use('/api/posts',  postRoutes);
app.use('/api/posts',  offerRoutes);   // POST /api/posts/:postId/offers
app.use('/api/offers', offerRoutes);   // GET  /api/offers/received|sent  PATCH /api/offers/:id/accept|decline|cancel
app.use('/api/transactions', transactionRoutes);
app.use('/api/posts/:postId/comments', commentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/users', userRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.listen(PORT, (error) =>{
    if(!error)
        console.log("Server is running, listening on port "+ PORT);
    else 
        console.log("Error occurred, server can't start", error);
    }
);

const initApp = async () => {
    try{
      const dbUri = process.env.DATABASE_URL as string;
      await connectDB(dbUri);
    }catch(error){
        if (error instanceof Error) {
            console.error(`Error init application: ${error.message}`);
            process.exit(1);
        } else {
            console.error("Error init application:", error);
            process.exit(1);
        }
    }
}

initApp();
