import { Router } from 'express';
import { createPost, getAllPosts, getPostsByUser, getPostById, updatePost, deletePost, toggleLike, uploadPostImages, toggleSave, getSavedPosts } from '../controllers/post.controller';
import { uploadPostImages as postImagesUpload } from '../middleware/upload.middleware';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Vintage post listings
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SellerSummary:
 *       type: object
 *       description: Partial seller profile attached to every post response.
 *       properties:
 *         _id:            { type: string, example: "664a1f2e8b3c4d0012ab0001" }
 *         username:       { type: string, example: "vintagejane" }
 *         profilePicture: { type: string, nullable: true, example: "/media/users/664a1f2e.jpg" }
 *
 *     PostSummary:
 *       type: object
 *       description: >
 *         A post document as returned by listing endpoints.
 *         The `isSaved` field is only present when the request is made with a
 *         valid Bearer token; unauthenticated callers receive `false` for every post.
 *       properties:
 *         _id:          { type: string,  example: "664b2a3c9d4e5f0023bc0002" }
 *         title:        { type: string,  example: "Vintage Levi's Jacket" }
 *         description:  { type: string,  example: "Great condition denim jacket from the 80s" }
 *         category:
 *           type: string
 *           enum: [clothing, accessories, jewelry, furniture, art, electronics, books, other]
 *         price:        { type: number,  example: 75 }
 *         condition:
 *           type: string
 *           enum: [like_new, excellent, good, fair, poor]
 *         year:         { type: integer, example: 1985 }
 *         brand:        { type: string,  example: "Levi's" }
 *         style:        { type: string,  example: "Casual" }
 *         images:
 *           type: array
 *           items: { type: string }
 *           example: ["/media/posts/664b2a3c/front.jpg"]
 *         status:
 *           type: string
 *           enum: [active, pending, sold, inactive]
 *           example: active
 *         viewsCount:   { type: integer, example: 42 }
 *         likesCount:   { type: integer, example: 7 }
 *         savesCount:
 *           type: integer
 *           description: Total number of users who have saved this post.
 *           example: 3
 *         isSaved:
 *           type: boolean
 *           description: >
 *             Whether the authenticated user has saved this post.
 *             Always `false` when the request is unauthenticated.
 *           example: false
 *         seller:
 *           $ref: '#/components/schemas/SellerSummary'
 *         createdAt:    { type: string, format: date-time }
 *         updatedAt:    { type: string, format: date-time }
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         total: { type: integer, description: "Total number of matching documents." }
 *         page:  { type: integer, description: "Current page number (1-based)." }
 *         limit: { type: integer, description: "Maximum documents per page." }
 *         pages: { type: integer, description: "Total number of pages." }
 */

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, category, price, condition, year, brand, style]
 *             properties:
 *               title:       { type: string, example: "Vintage Levi's Jacket" }
 *               description: { type: string, example: "Great condition denim jacket from the 80s" }
 *               category:    { type: string, enum: [clothing, accessories, jewelry, furniture, art, electronics, books, other] }
 *               price:       { type: number, example: 75 }
 *               condition:   { type: string, enum: [like_new, excellent, good, fair, poor] }
 *               year:        { type: number, example: 1985 }
 *               brand:       { type: string, example: "Levi's" }
 *               style:       { type: string, example: "Casual" }
 *               images:      { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Post created
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticate, createPost);

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts (with optional filters)
 *     description: >
 *       Returns active posts by default. Pass `?status=sold` to fetch sold items.
 *       When a valid Bearer token is included each post will contain an `isSaved`
 *       boolean indicating whether the requesting user has bookmarked that post.
 *       Unauthenticated requests are served normally — `isSaved` will be `false`
 *       on every post.
 *     tags: [Posts]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [clothing, accessories, jewelry, furniture, art, electronics, books, other] }
 *         description: Filter by category.
 *       - in: query
 *         name: condition
 *         schema: { type: string, enum: [like_new, excellent, good, fair, poor] }
 *         description: Filter by condition.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, pending, sold, inactive], default: active }
 *         description: Filter by listing status. Defaults to `active` when omitted.
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *         description: Return only posts priced at or above this value.
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *         description: Return only posts priced at or below this value.
 *     responses:
 *       200:
 *         description: Array of posts sorted by newest first.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PostSummary'
 */
router.get('/', optionalAuthenticate, getAllPosts);

/**
 * @swagger
 * /api/posts/user/{userId}:
 *   get:
 *     summary: Get all posts by a specific user
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of posts by user
 */
router.get('/user/:userId', getPostsByUser);

/**
 * @swagger
 * /api/posts/saved:
 *   get:
 *     summary: Get posts saved by the authenticated user
 *     description: >
 *       Returns the full post documents for every post the user has bookmarked,
 *       ordered by most recently saved first. Seller details are populated on
 *       each post. Supports cursor-less page/limit pagination.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: Page number (1-based).
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *         description: Maximum number of posts to return per page.
 *     responses:
 *       200:
 *         description: Paginated saved posts sorted by most recently saved.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PostSummary'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *             example:
 *               data:
 *                 - _id: "664b2a3c9d4e5f0023bc0002"
 *                   title: "Vintage Levi's Jacket"
 *                   price: 75
 *                   savesCount: 3
 *                   isSaved: true
 *                   seller: { _id: "664a1f2e8b3c4d0012ab0001", username: "vintagejane", profilePicture: null }
 *               pagination: { total: 5, page: 1, limit: 20, pages: 1 }
 *       401:
 *         description: Missing or invalid Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Authorization token missing" }
 *       404:
 *         description: Authenticated user record not found in the database.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User not found" }
 */
router.get('/saved', authenticate, getSavedPosts);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get a single post by ID
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post found
 *       404:
 *         description: Post not found
 */
router.get('/:id', getPostById);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update a post (seller only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:       { type: string }
 *               description: { type: string }
 *               category:    { type: string }
 *               price:       { type: number }
 *               condition:   { type: string }
 *               year:        { type: number }
 *               brand:       { type: string }
 *               style:       { type: string }
 *               images:      { type: array, items: { type: string } }
 *               status:      { type: string, enum: [active, sold, inactive] }
 *     responses:
 *       200:
 *         description: Post updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.put('/:id', authenticate, updatePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete a post (seller only)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Post deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.delete('/:id', authenticate, deletePost);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post (like if not liked, unlike if already liked)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Like toggled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liked:      { type: boolean }
 *                 likesCount: { type: number }
 *       404:
 *         description: Post not found
 */
router.post('/:id/like', authenticate, toggleLike);

/**
 * @swagger
 * /api/posts/{id}/images:
 *   post:
 *     summary: Upload images to a post (seller only, max 10 total)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [images]
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Image files (max 10 total across all uploads, 5 MB each)
 *     responses:
 *       200:
 *         description: Images uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 images:
 *                   type: array
 *                   items: { type: string }
 *       400:
 *         description: No files provided or would exceed 10-image limit
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Post not found
 */
router.post('/:id/images', authenticate, postImagesUpload.array('images', 10), uploadPostImages);

/**
 * @swagger
 * /api/posts/{id}/save:
 *   post:
 *     summary: Toggle save on a post
 *     description: >
 *       Bookmarks the post for the authenticated user if it is not already saved,
 *       or removes the bookmark if it is. The `saved` field in the response
 *       reflects the **new** state after the toggle — `true` means the post is
 *       now in the user's saved list, `false` means it was just removed.
 *       `savesCount` is the updated total number of users who have saved this post.
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: MongoDB ObjectId of the post to save or unsave.
 *     responses:
 *       200:
 *         description: >
 *           Save toggled successfully. Check `saved` to know whether the post
 *           was just bookmarked (`true`) or removed from the saved list (`false`).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [saved, savesCount]
 *               properties:
 *                 saved:
 *                   type: boolean
 *                   description: >
 *                     New save state for the requesting user.
 *                     `true` — post is now saved. `false` — post was unsaved.
 *                   example: true
 *                 savesCount:
 *                   type: integer
 *                   description: Updated total number of users who have saved this post.
 *                   example: 4
 *             examples:
 *               saved:
 *                 summary: Post was just bookmarked
 *                 value: { saved: true, savesCount: 4 }
 *               unsaved:
 *                 summary: Bookmark was just removed
 *                 value: { saved: false, savesCount: 3 }
 *       401:
 *         description: Missing or invalid Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Authorization token missing" }
 *       404:
 *         description: Post or authenticated user not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Post not found" }
 */
router.post('/:id/save', authenticate, toggleSave);

export default router;
