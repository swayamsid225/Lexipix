import userModel from "../models/userModel.js";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import express from 'express'
import razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";

const app = express()
app.use(express.json())

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.json({ sucess: false, message: 'Missing Details' })
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt)

        const userData = {
            name,
            email,
            password: hashedPassword
        }

        const newUser = new userModel(userData)
        const user = await newUser.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ sucess: true, token, user: { name: user.name } })
    } catch (err) {
        console.log(err);
        res.json({ sucess: false, message: err.message })
    }
}


const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userModel.findOne({ email })

        if (!user) {
            return res.json({ sucess: false, message: 'User does not exist' })
        }

        const isMatch = await bcrypt.compare(password, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

            res.json({ sucess: true, token, user: { name: user.name } })
        } else {
            return res.json({ sucess: false, message: 'Invalid credentials' })
        }
    } catch (err) {
        console.log(err)
        res.json({ sucess: false, message: err.message })
    }
}

const userCredits = async (req, res) => {
    try {
        const { userId } = req.body

        const user = await userModel.findById(userId)

        res.json({ sucess: true, credits: user.creditBalance, user: { name: user.name } })
    } catch (err) {
        console.log(err)
        res.json({ sucess: false, message: err.message })
    }
}

// razorpay gateway initialize
const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Payment API to add credits
const paymentRazorpay = async (req, res) => {
    try {

        const { userId, planId } = req.body

        const userData = await userModel.findById(userId)

        // checking for planId and userdata
        if (!userData || !planId) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        let credits, plan, amount, date

        // Switch Cases for different plans
        switch (planId) {
            case 'Basic':
                plan = 'Basic'
                credits = 100
                amount = 10
                break;

            case 'Advanced':
                plan = 'Advanced'
                credits = 500
                amount = 50
                break;

            case 'Business':
                plan = 'Business'
                credits = 5000
                amount = 250
                break;

            default:
                return res.json({ success: false, message: 'plan not found' })
        }

        date = Date.now()

        // Creating Transaction Data
        const transactionData = {
            userId,
            plan,
            amount,
            credits,
            date
        }

        // Saving Transaction Data to Database
        const newTransaction = await transactionModel.create(transactionData)

        // Creating options to create razorpay Order
        const options = {
            amount: amount * 100,
            currency: process.env.CURRENCY,
            receipt: newTransaction._id,
        }

        // Creating razorpay Order
        await razorpayInstance.orders.create(options, (error, order) => {
            if (error) {
                console.log(error);
                return res.json({ success: false, message: error });
            }
            res.json({ success: true, order });
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API Controller function to verify razorpay payment
const verifyRazorpay = async (req, res) => {
    try {

        const { razorpay_order_id } = req.body;

        // Fetching order data from razorpay
        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);

        // Checking for payment status
        if (orderInfo.status === 'paid') {
            const transactionData = await transactionModel.findById(orderInfo.receipt)
            if (transactionData.payment) {
                return res.json({ success: false, message: 'Payment Failed' })
            }

            // Adding Credits in user data
            const userData = await userModel.findById(transactionData.userId)
            const creditBalance = userData.creditBalance + transactionData.credits
            await userModel.findByIdAndUpdate(userData._id, { creditBalance })

            // Marking the payment true 
            await transactionModel.findByIdAndUpdate(transactionData._id, { payment: true })

            res.json({ success: true, message: "Credits Added" });
        }
        else {
            res.json({ success: false, message: 'Payment Failed' });
        }

    } catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message });
    }
}



export { registerUser, loginUser, userCredits, paymentRazorpay, verifyRazorpay }