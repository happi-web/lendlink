const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const User = require('../models/userModels');
const passport = require('passport');
const Admin = require('../models/adminModel');
const Kyc = require('../models/kycModels');

router.get('/new',(req,res)=>{
    res.render('admin/newadmin')
});

router.post('/new',(req,res)=>{   
    var newUser = new User({username: req.body.username, name: req.body.name, isAdmin: 'yes'});
    User.register(newUser,req.body.password, (err,user)=>{
        if(err){
            console.log(err);
            res.redirect('/')
        }
        passport.authenticate("local")(req,res, ()=>{
        res.redirect(`/admin/dashboard`);
        })
    } );

});

router.post('/login',passport.authenticate("local",{
    successRedirect: "/admin/dashboard",
    failureRedirect: "/admin/login"
}),(req,res)=>{
    
});

router.get('/login',(req,res)=>{
    res.render('admin/login');
});


router.get('/dashboard', isAdminAndLoggedIn, async (req, res) => {
    try {
        const users = await User.find({ isAdmin: 'no' }).exec();
        const filteredUsers = users.filter(user => !user._id.equals(req.user._id)).reverse();

        const user = await User.findById(req.user._id).exec();

        res.render('admin/adminHome', { users: filteredUsers, user: user });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/login');
    }
});

router.post('/kyc/delete/:kycid/user/:userid', isAdminAndLoggedIn, async (req, res) => {
    try {
        const kyc = await Kyc.findById(req.params.kycid).exec();
        const user = await User.findById(req.params.userid).exec();

        user.kyc = null;
        await user.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.get('/verify/:userid', isAdminAndLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).exec();
        const verifye = await User.findById(req.params.userid).exec();

        const kyc = await Kyc.findById(verifye.kyc).exec();
        res.render('admin/verify', { user: user, verifye: verifye, kyc: kyc });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

router.post('/verify/:userid', isAdminAndLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.params.userid).exec();
        user.kycstatus = 'approved';
        await user.save();
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/dashboard');
    }
});

function isAdminAndLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        if (req.user.isAdmin === 'yes') {
            return next();
        } else {
            res.redirect('/admin/login');
        }
    } else {
        res.redirect('/admin/login');  // Redirect to admin login page if not authenticated
    }
}




function isLoggedIn(req,res,next){
    // console.log(req.isAuthenticated());
     if(req.isAuthenticated()){
         return next();
     }
     res.redirect('/login');
 }
 



module.exports = router;