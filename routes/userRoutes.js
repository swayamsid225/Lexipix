import express from 'express'
import {registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay, verifyEmail, forgotPassword, resetPassword } from '../controllers/userController.js'
import userAuth from '../middlewares/auth.js'

const userRouter = express.Router()

userRouter.post('/register',registerUser)
userRouter.post('/verify-email',verifyEmail)
userRouter.post('/login',loginUser)
userRouter.get('/credits',userAuth,userCredits)
userRouter.post('/pay-razor',userAuth,paymentRazorpay)
userRouter.post('/verify-razor',verifyRazorpay)
userRouter.post('/forgot-password',forgotPassword)
userRouter.post('/reset-password/:id/:token', resetPassword);


export default userRouter

// localhost:4000/api/user/register
// localhost:4000/api/user/login
// localhost:4000/api/user/credits
