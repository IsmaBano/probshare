require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const path = require("path");
const methodOverride= require('method-override');
const session = require('express-session');
const passport = require("passport");
const mongoose = require("mongoose");
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const flash = require('connect-flash');

const app = express();

app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Configure session middleware
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

// Initialize Passport and flash messages
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Middleware to set flash messages in response locals
app.use(function (req, res, next) {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Database connected successfully'))
.catch(err => console.error('Database connection error:', err));;
 

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secrets: [String] ,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

 const defaultitems=["fictional character are best","I want to be an engineer but I dont like exams" ,"Being delusional is not so bad"];
 passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id).then(function (user, err) {
        done(err, user);
    })
    .catch(err=>{
        console.log(err);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    // callbackURL: "http://localhost:3000/auth/google/secrets",
    callbackURL: "https://probshare.onrender.com/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    passReqToCallback: true
},
    function (request, accessToken, refreshToken, profile, done) {
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return done(err, user);
        });
    }
));


app.get('/',function(req,res){
    res.render('home',{
        url:req.protocol+"://"+req.headers.host
    });
});

app.get('/auth/google',
    passport.authenticate('google', { scope:
        [ 'email', 'profile' ] }
  ));

  app.get( '/auth/google/secrets',
    passport.authenticate( 'google',  {
        failureRedirect: '/login'}),
     async(req,res)=>{
      res.redirect("/secrets");
     }
      );

app.get('/login',function(req,res){
res.render('login',{
    url:req.protocol+"://"+req.headers.host
});

});


app.get('/register',function(req,res){
    res.render('register',{
        url:req.protocol+"://"+req.headers.host
    });
    });

app.get('/secrets',function(req,res){
        if(req.isAuthenticated()){
            User.findById(req.user.id).then(function(founduser,err){
                if(err){
                  console.log(err);
                }
                else{
                  if(founduser){
                    if(founduser.secrets.length>0){
                        var value=founduser.secrets;
                     } else{
                           value=defaultitems;
                        }
                    res.render('secrets',{
                        url:req.protocol+"://"+req.headers.host,
                       usersec: value,
                    });
               
                }
            }
                    });
                }
         else {
        res.redirect("/login");
         }
        });



   app.get("/logout",function(req,res){
            req.logOut(function(err){
              if(err){
                return next(err);
              }
              res.redirect("/");
            });
  });

  app.get("/submit",function(req,res){
    if(req.isAuthenticated()){
        User.find ({"secrets" : {$ne:null}}).then(function(foundusers,err){
        if(err){
            console.log(err);
          }
          else{
            if(foundusers){
                res.render('submit',{
                    url:req.protocol+"://"+req.headers.host,
                    usersWithsecrets :foundusers,
                });
            }
          }
        });
    }
      else {
   res.redirect("/login");
      }
  });


      

  app.post("/register", function (req, res, next) {
    var newUser = new User({
        username: req.body.username
    });
    User.register(newUser, req.body.password, function (err, user) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('/register');
        }
        next();
    });
}, passport.authenticate('local', {
    successRedirect: '/secrets',
    failureRedirect: '/register',
    failureFlash: true
}));



app.post("/login", passport.authenticate("local",{
  successRedirect: "/secrets",
  failureRedirect: "/login"
}), function(req, res){
  
});



app.post("/submit", function(req, res) {
    const submittedSecret = req.body.text;
  
    User.findById(req.user.id)
      .then(function(foundUser) {
        if (foundUser) {
          foundUser.secrets.push(submittedSecret);
        return foundUser.save();
        } else {
          throw new Error('User not found');
        }
      })
      .then(function() {
        res.redirect("/submit");
      })
      .catch(function(err) {
        console.error("Error:", err);
        res.status(500).send("An error occurred while saving the secret.");
      });
  });



  const PORT=process.env.PORT || 3000;
  app.listen(PORT,function(){
      console.log("server is running");
  });
