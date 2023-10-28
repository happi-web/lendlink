const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/userModels');
const passport = require('passport');
const Loan = require('../models/loanModels');
const nodemailer = require("nodemailer");


var Finance = require('financejs');
var finance = new Finance();


//showing all loans

router.get('/showall', isLoggedIn, async (req, res) => {
    try {
        const loans = await Loan.find({ recepient: { $ne: req.user._id } }).sort({ dateRequested: -1 }).exec();
        const user = await User.findById(req.user._id).exec();
        res.render('loan/all', { loans: loans, user: user });
    } catch (err) {
        console.error(err);
        res.redirect('/loan/showall');
    }
});



//---------------------

//new loan routes ------------------

router.get('/new', isLoggedIn, (req, res) => {
   
    res.render('loan/newloan');
});

router.get('/daterem/:loanid', async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.loanid).exec();
        res.json(loan.dateRemaining);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post("/new", isLoggedIn, async (req, res) => {
    try {
        const loan = await Loan.create({
            recepient: req.user._id,
            amtReq: req.body.amount,
            interest: req.body.interest,
            dateRequested: Date.now(),
            dateDue: req.body.date * 30,
            dateRemaining: (req.body.date * 30) - 1,
            emi: finance.AM(req.body.amount, req.body.interest, req.body.date, 1)
        });

        const user = await User.findById(req.user._id);
        user.loansTaken.push(loan._id);
        await user.save();

        res.redirect(`/loan/${loan._id}`);
    } catch (err) {
        console.log(err);
        res.redirect('/loan/new');
    }
});

//------------------------

//loan details-----------------


router.get('/:loanid', isLoggedIn, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.loanid).exec();
        const user = await User.findById(req.user._id).exec();
        const recepient = await User.findById(loan.recepient).exec();
        
        res.render('loan/loandetails', { loan: loan, user: user, recepient: recepient });
    } catch (err) {
        console.error(err);
        res.redirect('/error-page'); // Redirect to an error page or handle the error appropriately
    }
});
//----------------

//bidding routes------------

router.get('/:loanid/bid', isLoggedIn, async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.loanid).exec();
        const user = await User.findById(req.user._id).exec();
        res.render('loan/bid', { loan: loan, user: user });
    } catch (err) {
        console.error(err);
        res.redirect('/error-page'); // Redirect to an error page or handle the error appropriately
    }
});

router.post('/:loanid/bid', async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.loanid).exec();
        
        if (req.body.amount <= (loan.amtReq - loan.amtSatisfied) && req.body.amount != 0) {
            const user = await User.findById(req.user._id).exec();

            if (user.wallet >= req.body.amount) {
                loan.collablender.push({ _id: user._id, amtcontrib: req.body.amount });
                let newsat = parseInt(loan.amtSatisfied) + parseInt(req.body.amount);
                loan.amtSatisfied = newsat;
                
                if (loan.amtSatisfied == loan.amtReq) {
                    loan.status = 'accepted';
                    const recepient = await User.findById(loan.recepient).exec();
                    recepient.wallet += loan.amtReq;
                    
                    for (const lender of loan.collablender) {
                        const lenderUser = await User.findById(lender._id).exec();
                        lenderUser.wallet -= lender.amtcontrib;
                        await lenderUser.save();
                    }
                    
                    await recepient.save();
                }
                
                user.wallet = parseInt(user.wallet) - parseInt(req.body.amount);
                
                await loan.save();
                await user.save();
                res.redirect(`/loan/${loan._id}`);
            } else {
                res.redirect('/loan/showall');
            }
        } else {
            res.redirect('/loan/showall');
        }
    } catch (err) {
        console.error(err);
        res.redirect('/error-page'); // Redirect to an error page or handle the error appropriately
    }
});

function isLoggedIn(req, res, next) {
    // console.log(req.isAuthenticated());
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/user/login');
}

const dayDuration = 10000;
setInterval(async () => {
    try {
        const loans = await Loan.find({ status: 'pending' }).exec();
        for (const loan of loans) {
            if (loan.timeForBid <= 0) {
                loan.status = 'declined';
                if (loan.collablender.length > 0) {
                    for (const lender of loan.collablender) {
                        const len = await User.findById(lender._id).exec();
                        len.wallet += lender.amtcontrib;
                        await len.save();
                    }
                }
            }
            loan.timeForBid -= 1;
            await loan.save();
        }
    } catch (err) {
        console.error(err);
    }
}, dayDuration);

// Interval to handle loan installments
setInterval(async () => {
    try {
        const loans = await Loan.find({ status: 'accepted', dateRemaining: { $gte: 0 } }).exec();
        for (const loan of loans) {
            if (loan.dateRemaining % 30 === 0) {
                const recepient = await User.findById(loan.recepient).exec();
                recepient.wallet -= loan.emi;
                await recepient.save();

                for (const lender of loan.collablender) {
                    const lenderr = await User.findById(lender._id).exec();
                    lenderr.wallet += parseFloat((lender.amtcontrib / loan.amtReq) * loan.emi);
                    await lenderr.save();
                }
            }

            loan.dateRemaining -= 1;
            if (loan.dateRemaining < 0) {
                loan.status = 'paid';
            }

            await loan.save();
        }
    } catch (err) {
        console.error(err);
    }
}, dayDuration);

module.exports = router;