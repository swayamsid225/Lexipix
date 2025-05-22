import userModel from "../models/userModel.js";
import FormData from "form-data";
import axios from 'axios';

export const generateImage = async (req, res) => {
    try {
        const { userId, prompt } = req.body;

        // Validate request
        if (!userId || !prompt) {
            return res.status(400).json({ success: false, message: 'Missing Details' });
        }

        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.creditBalance <= 0) {
            return res.status(403).json({
                success: false,
                message: 'No Credit Balance',
                creditBalance: user.creditBalance
            });
        }

        // Prepare request to ClipDrop
        const formData = new FormData();
        formData.append('prompt', prompt);

        const { data } = await axios.post(
            'https://clipdrop-api.co/text-to-image/v1',
            formData,
            {
                headers: {
                    ...formData.getHeaders(),
                    'x-api-key': process.env.CLIPDROP_API,
                },
                responseType: 'arraybuffer'
            }
        );

        // Convert binary to base64
        const base64Image = Buffer.from(data, 'binary').toString('base64');
        const resultImage = `data:image/png;base64,${base64Image}`;

        // Deduct 1 credit
        const updatedUser = await userModel.findByIdAndUpdate(
            user._id,
            { $inc: { creditBalance: -1 } },
            { new: true }
        );

        // Send response
        return res.status(200).json({
            success: true,
            message: "Image Generated",
            creditBalance: updatedUser.creditBalance,
            resultImage
        });

    } catch (err) {
        console.error("Error in generateImage:", err.message || err);
        return res.status(500).json({
            success: false,
            message: "Image generation failed. Please try again later."
        });
    }
};

