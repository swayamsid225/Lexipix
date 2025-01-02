import mongoose from 'mongoose';

const connectDB = async () => {
    mongoose.connection.on('connected', ()=>{
        console.log("Dtabase Connected");
    })

    await mongoose.connect(`${process.env.MONGODB_URI}/lexipix`)
}

export default connectDB;
