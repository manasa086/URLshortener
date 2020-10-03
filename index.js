var PORT = process.env.PORT || 5000;
// var express = require('express');
// var app = express();

// var http = require('http');
// var server = http.Server(app);

// app.use(express.static('client'));

// server.listen(PORT, function() {
//     console.log('Chat server running');
// });

// var io = require('socket.io')(server);

// io.on('connection', function(socket) {
//     socket.on('message', function(msg) {
//         io.emit('message', msg);
//     });
// });

var express = require('express');
var path = require('path');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
let insertData = [];

var emailforgotpass = "";
var cookieParser = require('cookie-parser');

var shortid = require("shortid");
var cors = require("cors");
var validURL = require("valid-url");
const mongodb = require("mongodb");
const app = express();
const bodyParser = require("body-parser");
const mongoClient = mongodb.MongoClient;
const url = "mongodb://localhost:27017";
app.use(bodyParser.json());




app.use(logger('dev'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'client')));

// app.use('/', indexRouter);
// app.use('/users', usersRouter);


app.get("/", async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        client.close();
    } catch (error) {
        if (client)
            client.close();
    }

});
var authenticate = function(req, res, next) {
    if (req.body.token) {
        jwt.verify(req.body.token, process.env.JWT_SECRET, function(err, decoded) {
            if (decoded) {
                next();
            } else {
                res.json({
                    message: "Token is not valid"
                })
            }
        });
        //next();
    } else {
        res.json({
            message: "Not Authenticated"
        });
    }
};

app.post("/", async function(req, res) {
    let client;

    insertData.push(req.body);

    client = await mongoClient.connect(url);
    let db = client.db(dbname);
    let salt = await bcrypt.genSalt(10);
    let email_given = req.body.email;
    let mail_to_send = email_given;
    // let hash = await bcrypt.hash(req.body.password, salt);
    // req.body.password = hash;
    let matched = false;

    let cursor = db.collection("users").find({ email: email_given }).toArray();
    cursor.then(function(data) {
        for (let i = 0; i < data.length; i++) {
            if (data[i].email == email_given) {

                matched = true;
                break;
            }
        }
        if (!matched) {
            client.close();
            sendMail(mail_to_send, req, res);
        } else {
            client.close();
            donotSendMail(res);
        }
    }).catch((error) => {
        if (client)
            client.close();
        console.log(error);
    });
    // // await db.collection("users").insertOne(req.body);
    // client.close();
    // // return res.redirect('http://localhost:3001/login');
    // res.json({
    //     message: "Verify Your Email to Activate Your Account",
    // })


});


function donotSendMail(res) {
    res.status(500).json({
        message: "Username Already Exists, Provide New Username"
    });
}

async function sendMail(mail_to_send, req, res) {

    // console.log(insertData);
    // console.log(req.body)
    let transporter = nodemailer.createTransport({
        service: 'Gmail',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS
        },
        tls: {
            rejectUnauthorized: false
        }
    });
    let url = "http://localhost:3001/register/MailVerify";
    let info = await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: mail_to_send,
        subject: "URL Shortener",
        text: "Hello World",
        html: `<a href=${url}>Please Click on the URL to Register</a>`
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

    res.json({
        message: "Email is Sent to the Account.Please Verify Your Mail"
    })
}
// main().catch(console.error);

app.get("/MailVerify", async function(req, res) {

    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let salt = await bcrypt.genSalt(10);
        let email_given = insertData[0].email;
        let hash = await bcrypt.hash(insertData[0].password, salt);
        // req.body.password = hash;
        insertData[0].password = hash;
        await db.collection("users").insertOne(insertData[0]);
        insertData.pop();
        console.log(insertData)
        client.close();
        res.sendFile(path.join(__dirname + '/front_end/index.html'));
    } catch (error) {
        if (client)
            client.close();
        res.json({
            message: error
        })
    }

});
app.get("/dash.html", function(req, res) {
    res.sendFile(path.join(__dirname + '/front_end/dash.html'));
});

app.get("/index.html", function(req, res) {
    res.sendFile(path.join(__dirname + '/front_end/index.html'));
});
app.get("/confirmation/register.html", function(req, res) {
    res.sendFile(path.join(__dirname + '/front_end/register.html'));
});
app.get("/confirmation/index.html", function(req, res) {
    res.sendFile(path.join(__dirname + '/front_end/index.html'));
});

app.get("/confirmation/dash.html", function(req, res) {
    res.sendFile(path.join(__dirname + '/front_end/dash.html'));
});
app.post("/login", async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let user = await db.collection("users").findOne({ email: req.body.email });
        if (user) {
            let result = await bcrypt.compare(req.body.password, user.password);
            let token = jwt.sign({ id: user.email }, process.env.JWT_SECRET);
            if (result) {
                client.close();
                res.json({
                    message: "Success",
                    token
                })
            } else {
                client.close();
                res.json({
                    message: "Username or Password is incorrect"
                })
            }
        } else {
            client.close();
            res.status(404).json({
                message: "User not found"
            })
        }


    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }

});
app.post("/displayURL", authenticate, async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        var urlData = await db.collection("url").find({ email: req.body.email }).toArray();
        console.log(urlData);
        if (urlData.length > 0) {
            res.json({
                message: urlData,
            })
        } else {
            res.json({
                message: "No data found"
            })
        }
    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }
})
app.post("/storeURL", authenticate, async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let shortcode = shortid.generate();
        var d = new Date();
        var date = d.getDate();
        var month = d.getMonth() + 1
        var year = d.getFullYear();
        var dateStr = date.toString() + "/" + month.toString() + "/" + year.toString();
        var find = await db.collection("url").find({ email: req.body.email, longURL: req.body.longURL, date: dateStr }).toArray();
        console.log(find);
        if (find.length == 0) {
            if (validURL.isUri(req.body.longURL)) {
                // http://localhost:5000
                let shortURL = "http://localhost:3001" + "/register/" + shortcode;
                let insertData = await db.collection("url").insertOne({
                    email: req.body.email,
                    longURL: req.body.longURL,
                    shortURL: shortURL,
                    urlCode: shortcode,
                    date: dateStr
                });
                client.close();
                res.json({
                    message: "URL data inserted",
                });
            } else {
                client.close();
                res.json({ message: "Provide a Valid URL" });
            }
        } else {
            res.json({ message: "Provided URL already exists" });
        }

    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }
});

app.get("/:code", async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        //  let user = await db.collection("users").findOne({ email: req.body.email });
        let findURL = await db.collection("url").findOne({ urlCode: req.params.code });
        console.log(findURL, req.params.code);
        if (findURL) {
            return res.redirect(findURL.longURL);
        } else {
            res.status(404).json({
                message: "No URL Found",
            })
        }


    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }


});

app.post("/dashboard", authenticate, async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let count = await db.collection("url").find({ email: req.body.email }).toArray();
        //console.log(count);
        if (count) {
            let jsonDateCount = {};
            let jsonMonthCount = {};
            for (let i = 0; i < count.length; i++) {
                let count_date = count[i].date;
                if (jsonDateCount.hasOwnProperty(count_date)) {
                    jsonDateCount[count_date]++;
                } else {
                    jsonDateCount[count_date] = 1;
                }

            }
            for (let i = 0; i < count.length; i++) {
                let count_date = count[i].date;
                let to_split_date = count_date.split("/");
                let month_count = to_split_date[1] + "/" + to_split_date[2];
                if (jsonMonthCount.hasOwnProperty(month_count)) {
                    jsonMonthCount[month_count]++;
                } else {
                    jsonMonthCount[month_count] = 1;
                }

            }
            client.close();
            // console.log(jsonDateCount);
            // console.log(jsonMonthCount);
            res.json({
                day: jsonDateCount,
                month: jsonMonthCount


            });
        } else {
            client.close();
            res.json({
                day: 0,
                month: 0
                    // message: "Got Data"
            });
        }

    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }
});

app.post("/forgotPassword", async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let user = await db.collection("users").findOne({ email: req.body.email });
        let mail_to_send = req.body.email;
        if (user) {
            let token = jwt.sign({ email: req.body.email }, process.env.EMAIL_SECRET);
            let transporter = nodemailer.createTransport({
                service: 'Gmail',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_PASS
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            let url = `http://localhost:3001/register/confirmation/${token}`;
            let email = await db.collection("forgotpassword").insertOne({ email: req.body.email, url: url });
            let info = await transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: mail_to_send,
                subject: "Forgot Password",
                text: "Click the below link for changing the password",
                html: `<a href=${url}>Please click this url to change the password</a>`
            });
            client.close();

            res.json({
                message: "Check your email for changing the password",
            })
        } else {
            client.close();
            res.status(404).json({
                message: "User not found",
            })
        }
    } catch (error) {
        if (client)
            client.close();
        console.log(error);
    }
});

let confirm_forgotPass = false;
app.get("/confirmation/:token", async function(req, res) {

    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        let url_speci = `http://localhost:3001/register/confirmation/${req.params.token}`;
        let email_ver = jwt.verify(req.params.token, process.env.EMAIL_SECRET);
        console.log(email_ver);
        let removeData = await db.collection("forgotpassword").remove({ email: email_ver.email, url: url_speci });
        client.close();
        confirm_forgotPass = true;
        emailforgotpass = email_ver.email;
        res.sendFile(path.join(__dirname + '/front_end/forgotPassword.html'));
    } catch (error) {
        if (client)
            client.close();
        res.json({
            message: error
        })
    }


});
app.get("/confirm", async function(req, res) {
    if (confirm_forgotPass) {
        res.json({
            message: "Mail Verified"
        });
    } else {
        res.json({
            message: "Mail not verified"
        })
    }
    // let client;
    // try {
    //     client = mongoClient.connect(url);
    //     let db = client.db(dbname);
    //     let url_speci = `http://localhost:3001/register/confirmation/${req.body.token}`;
    //     let data = db.collection("forgotpassword").findOne({
    //         email: req.body.email,
    //         url: url_speci,
    //     });
    //     if (data) {
    //         client.close();
    //         res.json({
    //             message: "Mail not verified",
    //         })
    //     } else {
    //         client.close();
    //         res.json({
    //             message: "Mail Verified"
    //         })
    //     }



    // } catch (error) {
    //     if (client)
    //         client.close();
    //     console.log(error);
    // }


});

app.post("/changePassword", async function(req, res) {
    let client;
    try {
        client = await mongoClient.connect(url);
        let db = client.db(dbname);
        if (emailforgotpass != req.body.email) {
            emailforgotpass = "";
            res.json({
                message: "Email ID does not Match. Please Provide Same Email ID",
            });
        } else {
            if (req.body.newpassword === req.body.reenternewpassword) {
                let salt = await bcrypt.genSalt(10);
                let hash = await bcrypt.hash(req.body.newpassword, salt);
                // console.log(req.body.newpassword, hash, req.body.email);
                // console.log();
                let changePass = await db.collection("users").findOneAndUpdate({ email: req.body.email }, { $set: { password: hash } });
                if (changePass) {
                    console.log("hello")
                    res.status(200).json({
                        message: "Password Changed Successfully",
                    })
                } else {
                    res.status(500).json({
                        message: "Something went wrong"
                    })
                }
            } else {
                res.status(404).json({
                    message: "Both passwords do not match",
                })
            }
        }
    } catch (error) {
        console.log(error);
    }
});



app.listen(PORT);