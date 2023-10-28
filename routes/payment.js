const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/userModels');
const passport = require('passport');
const keyPublishable = 'pk_test_m7ltFnHSd4IR7ItEO0GB80Cx00g1qDTx61';
const keySecret = "sk_test_rQhGlOMNXMMfF0X19pdlekas00ZjP219T3";

const stripe = require("stripe")(keySecret);

router.get('/charge', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).exec();
        res.render('payments/recharge', { keyPublishable, user });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

router.post("/charge", isLoggedIn, async (req, res) => {
    try {
        const amount = req.body.amt;

        const customer = await stripe.customers.create({
            email: req.body.email,
            source: req.body.stripeToken
        });

        const charge = await stripe.charges.create({
            amount,
            description: "New recharge",
            currency: "inr",
            customer: customer.id
        });

        const user = await User.findById(req.user._id).exec();
        user.wallet += charge.amount;
        await user.save();

        res.redirect('/user/dashboard');
    } catch (err) {
        console.error("Error:", err);
        res.status(500).send({ error: "Purchase Failed" });
    }
});

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/user/login');
}

module.exports = router;
