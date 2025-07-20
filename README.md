# LexiPix - AI-Powered Text-to-Image Generator

LexiPix is a full-stack web application that enables users to generate AI-powered images from text prompts, store their history, make secure payments, and receive email confirmations — all built with the **MERN stack**, integrated with **OpenAI**, **Cloudinary**, **Razorpay**, and **Gmail SMTP**.

---

## Features

-  Generate images from text using OpenAI
-  Pay for image credits using Razorpay & Stripe
-  User authentication with Google OAuth and JWT
-  Cloudinary image storage
-  Email confirmation after generation
-  View image generation history
-  Secure and scalable backend (Redis, PM2, MongoDB)
-  Rate-limiting, CORS, and environment-aware configs

---

##  Tech Stack

### Frontend:
- React
- Axios
- React Google Login

### Backend:
- Node.js + Express
- MongoDB + Mongoose
- Redis (for caching)
- OpenAI API
- Razorpay & Stripe (Payments)
- Nodemailer (Emails)
- Cloudinary (Media uploads)
- JWT + bcrypt (Authentication)

---

##  Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/lexipix.git
cd lexipix
