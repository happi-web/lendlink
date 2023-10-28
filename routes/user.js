const express = require('express');
const router  = express.Router();
const mongoose = require('mongoose');
const User = require('../models/userModels');
const passport = require('passport');
const Loan = require('../models/loanModels');
const multer = require('multer');
const Kyc=require('../models/kycModels');
const fs = require('fs-extra');
const util = require('util');
const bts = require('base64-to-image');

var storage = multer.diskStorage({
    destination: 'public/userAssets/uploads/',
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now()+ '.jpg')
    }
})

var uploadtest = multer({limits: {fileSize: 2000000 },dest:'/uploads/'}) 

router.get('/test',isLoggedIn,(req,res)=>{
    res.render('test');
});

router.post('/test',uploadtest.single('pic1'),(req,res)=>{
    if(req.file == null){
        res.render('/test',{message: 'Upload!'});
    }else{
        var newImg = fs.readFileSync(req.file.path);
        var encImg = newImg.toString('base64');
       
        User.findById(req.user._id,(err,user)=>{
            user.profilePic = encImg;
            user.save();
            fs.remove(req.file.path,(err)=>{
                res.render('success');
            })
        });
    }
});

router.get('/all',(req,res)=>{
    User.find({},(err,users)=>{
        res.send(users);
    })
})

router.get('/final',isLoggedIn,(req,res)=>{
    User.findById(req.user._id,(err,user)=>{
      res.render('final',{user});
    })
})

var storageKyc = multer.diskStorage({
    destination: 'public/userAssets/uploads/kyc',
    filename: function (req, file, cb) {
      cb(null, file.fieldname + '-' + Date.now()+ '.jpg')
    }
})
var upload = multer({ storage: storage })

var uploadKyc = multer({ storage: storageKyc })


router.post('/flush/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).exec();
        if (user) {
            user.wallet -= req.body.trans;
            if (user.wallet >= 0) {
                await user.save();
            }
        }
        res.redirect('/user/dashboard');
    } catch (err) {
        console.error(err);
        res.redirect('/error-page'); // Redirect to an error page or handle the error appropriately
    }
});

router.get('/new',(req,res)=>{
    message ="";
    res.render('user/signup',{message});
});


router.post('/new',uploadtest.single('file'),(req,res)=>{
  // console.log(req.file);

    if(req.file== null){
        res.render('user/signup',{message: "Complete all fields"});
    }else{
        var newImg = fs.readFileSync(req.file.path);
        var encImg = newImg.toString('base64');
        var orgs = req.body.orgs.split(',');
    var newUser = new User({
        username: req.body.username,
        name: req.body.name, 
        email: req.body.email,
        profilePic: encImg,
        dob: req.body.dob,
        currentDesignation: req.body.curdesig,
        educationalQualiication: req.body.edu,
        organizations: orgs,
        gender: req.body.gender   
    });
    User.register(newUser,req.body.password, (err,user)=>{
        if(err){
            console.log(err);
            res.redirect('user/new');
        }
        passport.authenticate("local")(req,res, ()=>{
        res.redirect(`/user/dashboard`)
        })
    } );
    }
})

router.get ('/kyc',isLoggedIn,(req,res)=>{
    res.render('user/kyc',{message:""});
})
router.post('/kyc', isLoggedIn, uploadtest.fields([
    { name: 'adhaarImage', maxCount: 1 },
    { name: 'panImage', maxCount: 1 },
    { name: 'salarySlip', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.body.adhaarno || !req.body.panno || !req.body.salary || !req.body.profile) {
            return res.render('user/kyc', { message: 'Please provide all required information and upload all images.' });
        }

        const newAdhaar = fs.readFileSync(req.files.adhaarImage[0].path);
        const encAd = newAdhaar.toString('base64');
        const newPan = fs.readFileSync(req.files.panImage[0].path);
        const encPa = newPan.toString('base64');
        const newSal = fs.readFileSync(req.files.salarySlip[0].path);
        const encSal = newSal.toString('base64');

        const kyc = await Kyc.create({
            adhaarno: req.body.adhaarno,
            panno: req.body.panno,
            salary: req.body.salary,
            profile: req.body.profile,
            adhaarImage: encAd,
            panImage: encPa,
            salarySlip: encSal
        });

        await fs.remove(req.files.adhaarImage[0].path);
        await fs.remove(req.files.panImage[0].path);
        await fs.remove(req.files.salarySlip[0].path);

        const user = await User.findById(req.user._id);
        if (user) {
            user.kyc = kyc._id;
            await user.save();
            return res.redirect('/user/dashboard');
        } else {
            return res.status(404).send('User not found');
        }
    } catch (err) {
        console.error(err);
        return res.status(500).send('Internal Server Error');
    }
});


router.get('/dashboard', isLoggedIn, (req, res) => {
    // Assuming you have a User model
    User.findById(req.user._id)
        .then(user => {
            if (!user) {
                return res.status(404).send('User not found');
            }

            return Promise.all([
                Loan.find({ recepient: req.user._id, status: 'pending' }),
                Loan.find({ recepient: req.user._id, status: 'accepted' }),
                Loan.find({ 'collablender._id': req.user._id })
            ])
            .then(([pendingLoans, acceptedLoans, collabLoans]) => {
                res.render('user/dashboard/dashboard', { user, collabLoans, acceptedLoans, pendingLoans });
            })
            .catch(err => {
                console.error(err);
                res.status(500).send('Internal Server Error');
            });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Internal Server Error');
        });
});
router.get('/login', (req, res) => {
    res.render('user/login');
});



router.post('/login',passport.authenticate("local",{
    successRedirect: "/user/dashboard",
    failureRedirect: "/user/login"
}),(req,res)=>{
    
});

router.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });


router.get('/profile/:id', isLoggedIn, async (req, res) => {
    try {
        const [user, loguser] = await Promise.all([
            User.findById(req.params.id),
            User.findById(req.user._id)
        ]);

        if (user && loguser) {
            res.render('user/dashboard/user', { user, luser: loguser });
        } else {
            res.status(404).send('User not found');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});


function isLoggedIn(req,res,next){
    // console.log(req.isAuthenticated());
     if(req.isAuthenticated()){
         return next();
     }
     res.redirect('/user/login');
 }
 
module.exports = router;