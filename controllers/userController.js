import userModel from "../models/userModel.js";
import transactionModel from "../models/transactionModel.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import razorpay from 'razorpay';
import redisClient from "../config/redis.js";
import nodemailer from 'nodemailer';
import { SendVerificationCode, WelcomeEmail } from "../middlewares/Email.js";

// ------------------ REGISTER ------------------
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.json({ success: false, message: 'Missing Details' }).status(400);

    const existingUser = await userModel.findOne({ email });
    if (existingUser)
      return res.json({ success: false, message: 'Email is already registered' }).status(400);

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await userModel.create({
      name,
      email,
      password: hashedPassword,
      verificationCode
    });

    await SendVerificationCode(user.email, verificationCode);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await redisClient.setEx(`session:${token}`, 300, JSON.stringify({ id: user._id }));

    res.status(200).json({
      success: true,
      token,
      user: { name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Internal Server Error' }).status(500);
  }
};

// ------------------ VERIFY EMAIL ------------------
const verifyEmail = async (req, res) => {
  try {
    const { otp: code } = req.body;
    const user = await userModel.findOne({ verificationCode: code });

    if (!user)
      return res.json({ success: false, message: 'Invalid or Expired Code' }).status(400);

    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();

    await WelcomeEmail(user.email, user.name);

    res.json({ success: true, message: 'Email Verified Successfully' }).status(200);
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Internal Server Error' }).status(500);
  }
};

// ------------------ LOGIN ------------------
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });
    if (!user)
      return res.json({ success: false, message: 'User does not exist' }).status(404);

    if (!user.isVerified)
      return res.json({ success: false, message: 'Email is not verified' }).status(400);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.json({ success: false, message: 'Invalid credentials' }).status(401);

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    await redisClient.setEx(`session:${token}`, 3600, JSON.stringify({ id: user._id }));

    res.status(200).json({
      success: true,
      token,
      user: { name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: 'Internal Server Error' }).status(500);
  }
};

// ------------------ FORGOT PASSWORD ------------------
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email)
      return res.send({ message: "Please provide Email" }).status(400);

    const user = await userModel.findOne({ email });
    if (!user)
      return res.send({ message: "User not found! Please Register" }).status(400);

    const secret = process.env.JWT_SECRET + user.password;
    const token = jwt.sign({ email, id: user._id }, secret, { expiresIn: "1h" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: "lexipix@gmail.com",
      to: email,
      subject: "Password Reset Request",
      text: `Reset link: ${process.env.CLIENT_URL}/reset-password/${user._id}/${token}`,
    });

    res.status(200).send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false });
  }
};

// ------------------ RESET PASSWORD ------------------
const resetPassword = async (req, res) => {
  try {
    const { token, id } = req.params;
    const { password } = req.body;

    if (!password)
      return res.send({ message: "Please provide a new password" }).status(400);

    const user = await userModel.findById(id);
    if (!user)
      return res.send({ message: "Invalid user ID" }).status(400);

    const secret = process.env.JWT_SECRET + user.password;

    try {
      jwt.verify(token, secret);
    } catch (err) {
      return res.send({ message: "Invalid or expired token" }).status(400);
    }

    user.password = await bcrypt.hash(password, 10);
    await user.save();

    res.status(200).send({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false });
  }
};

// ------------------ USER CREDITS ------------------
const userCredits = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 1. Check Redis cache
    const cached = await redisClient.get(`credits:${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return res.status(200).json({
        success: true,
        credits: parsed.credits,
        user: { name: parsed.name },
      });
    }

    // 2. Fallback to MongoDB
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 3. Cache the credit and name
    await redisClient.setEx(
      `credits:${userId}`,
      60,
      JSON.stringify({ credits: user.creditBalance, name: user.name })
    );

    res.status(200).json({
      success: true,
      credits: user.creditBalance,
      user: { name: user.name },
    });
  } catch (err) {
    console.error("Credits Error:", err.message);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



// ------------------ RAZORPAY INIT ------------------
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ------------------ CREATE PAYMENT ORDER ------------------
const paymentRazorpay = async (req, res) => {
  try {
    const { userId, planId } = req.body;
    const user = await userModel.findById(userId);
    if (!user || !planId)
      return res.json({ success: false, message: 'Missing Details' }).status(400);

    let credits, plan, amount;
    switch (planId) {
      case 'Basic':
        plan = 'Basic'; credits = 100; amount = 100; break;
      case 'Advanced':
        plan = 'Advanced'; credits = 500; amount = 450; break;
      case 'Business':
        plan = 'Business'; credits = 5000; amount = 4500; break;
      default:
        return res.json({ success: false, message: 'Plan not found' }).status(400);
    }

    const transaction = await transactionModel.create({
      userId, plan, amount, credits, date: Date.now()
    });

    const options = {
      amount: amount * 100,
      currency: process.env.CURRENCY,
      receipt: transaction._id.toString()
    };

    razorpayInstance.orders.create(options, (error, order) => {
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.status(200).json({ success: true, order });
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message }).status(500);
  }
};

// ------------------ VERIFY PAYMENT ------------------
const verifyRazorpay = async (req, res) => {
  try {
    const { razorpay_order_id } = req.body;
    const order = await razorpayInstance.orders.fetch(razorpay_order_id);

    if (order.status !== 'paid') {
      return res.json({ success: false, message: 'Payment Failed' });
    }

    const transaction = await transactionModel.findById(order.receipt);
    if (!transaction || transaction.payment) {
      return res.json({ success: false, message: 'Invalid or duplicate transaction' });
    }

    const user = await userModel.findById(transaction.userId);
    const newBalance = user.creditBalance + transaction.credits;

    await userModel.findByIdAndUpdate(user._id, { creditBalance: newBalance });
    await transactionModel.findByIdAndUpdate(transaction._id, { payment: true });

    // Invalidate Redis cache
    await redisClient.del(`credits:${user._id}`);

    res.json({ success: true, message: "Credits Added" });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message }).status(500);
  }
};

export {
  registerUser,
  verifyEmail,
  loginUser,
  forgotPassword,
  resetPassword,
  userCredits,
  paymentRazorpay,
  verifyRazorpay
};


