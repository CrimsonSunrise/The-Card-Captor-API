const express = require("express");
const app = express();
const cors = require("cors");
const http = require("http").Server(app);
const PORT = 4000;
const fs = require("fs");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { uploadFile } = require("./s3");
const MongoClient = require("mongodb").MongoClient;
const MONGODB_URL = process.env.MONGODB_URL;
const https = require("https");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
app.use(express.urlencoded());
app.use(express.json());

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const {rando} = require('@nastyox/rando.js');

app.use(cors());

// const socketIO = require("socket.io")(http, {
//     cors: {
//         origin: "http://localhost:3000",
//     },
// });
// const savedData = fs.readFileSync("data.json");
// const objectData = JSON.parse(savedData);
// function findProduct(nameKey, myArray, last_bidder, amount) {
//     for (let i = 0; i < myArray.length; i++) {
//         if (myArray[i].name === nameKey) {
//             myArray[i].last_bidder = last_bidder;
//             myArray[i].price = amount;
//         }
//     }
//     const stringData = JSON.stringify(objectData, null, 2);
//     fs.writeFile("data.json", stringData, (err) => {
//         console.error(err);
//     });
// }

// socketIO.on("connection", (socket) => {
//     console.log(`⚡: ${socket.id} user just connected!`);
//     socket.on("disconnect", () => {
//         console.log("🔥: A user disconnected");
//     });

//     socket.on("addProduct", (data) => {
//         objectData["products"].push(data);
//         const stringData = JSON.stringify(objectData, null, 2);
//         fs.writeFile("data.json", stringData, (err) => {
//             console.error(err);
//         });
//         socket.broadcast.emit("addProductResponse", data);
//     });

//     socket.on("bidProduct", (data) => {
//         findProduct(
//             data.name,
//             objectData["products"],
//             data.last_bidder,
//             data.amount
//         );
//         socket.broadcast.emit("bidProductResponse", data);
//     });
// });

// app.get("/api", (req, res) => {
//     const data = fs.readFileSync("data.json");
//     const products = JSON.parse(data);
//     res.json({products});
// });

app.post(
    "/saveCard",
    upload.fields([
        { name: "background", maxCount: 1 },
        { name: "subject", maxCount: 1 },
    ]),
    async (req, res) => {

        const title = req.body.title;
        const background = req.files.background;
        const subject = req.files.subject;
        
        const result = await uploadFile({
            background: background,
            subject: subject,
        });

        if (result != "err") {
            console.log("sucesso");
            fs.unlinkSync("./uploads/" + background[0].filename);
            fs.unlinkSync("./uploads/" + subject[0].filename);

            MongoClient.connect(MONGODB_URL, function (err, db) {
                if (err) throw err;
                var dbo = db.db("Thecardcaptor");
                var myobj = {
                    title: title,
                    background: background[0].filename,
                    subject: subject[0].filename,
                    collection: null,
                    album: null,
                    rarity: 0,
                    fresh: true,
                    createdBy: req.body.createdBy,
                };
                
                dbo.collection("Cards").insertOne(myobj, function (err, res) {
                    if (err) throw err;
                    console.log("1 document inserted");
                    db.close();
                });
            });

            res.sendStatus(200);
        } else {
            res.send("err");
        }
    }
);

app.get("/getFiles", (req, res) => {
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) {
            res.send("err");
            throw err;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Cards")
            .find({})
            .toArray(function (error, result) {
                if (error) throw error;
                res.status(200).json({ cards: result });

                db.close();
            });
    });
});

app.post("/getCard", (req, res) => {
    
    const cardId = req.body.cardId;
    
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) {
            res.send("err");
            throw err;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Cards")
            .findOne({ _id: ObjectId(cardId) },
            function (error, result) {
                if (error) throw error;
                res.status(200).json({ card: result });

                db.close();
            });
    });
    
})

app.post("/updateCard", (req, res) => {
    const card = req.body.card;
    const cardId = card._id;

    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) throw err;
        const dbo = db.db("Thecardcaptor");

        var myquery = { _id: ObjectId(cardId) };
        var newvalues = { $set: { ...card, _id: ObjectId(cardId) } };
        dbo.collection("Cards").updateOne(
            myquery,
            newvalues,
            function (err, res) {
                if (err) {
                    res.send("err");
                    throw err;
                }
                console.log("1 document updated");
                db.close();
            }
        );
    });

    res.status(200).json({});
});

app.post("/login", (req, res) => {
    
    const email = req.body.email;
    const password = req.body.password;
    
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) throw err;
        const dbo = db.db("Thecardcaptor");

        var myquery = { email: email, password: password };
        dbo.collection("Accounts").findOne(
            myquery,
            function (mdErr, mdRes) {
                if (mdErr) {
                    res.send("err");
                    throw err;
                }
                
                if (mdRes != null) {
                    
                    db.close();
                    
                    const userAuth = (({ email, password }) => ({ email, password }))(mdRes);
                    
                    const userResponse = (({ _id, username, email, coins, cards, unlocks, auction }) => ({ _id, username, email, coins, cards, unlocks, auction }))(mdRes);
                    
                    userAuth.info = userResponse;
                    
                    jwt.sign(userAuth, PRIVATE_KEY, (err, token) => {
                        if (err) {
                            res.status(500).json({ mensagem: "Erro ao gerar o JWT" });
            
                            return;
                        }
                        
                        userAuth.info.token = token;
                        
                        res.status(200).json({ user: userAuth.info });
                        res.end();
                    });
                    
                } else {
                    
                    res.status(201);
                    res.end();
                }
                
            }
        );
    });
    
});

const middlewareValidarJWT = (req, res, next) => {
    const authorization = req.headers["authorization"];

    // Efetuando a validação do JWT:
    jwt.verify(authorization, PRIVATE_KEY, (err, userInfo) => {
        if (err) {
            res.status(403).end();
            return;
        }
        
        MongoClient.connect(MONGODB_URL, function (err, db) {
            const dbo = db.db("Thecardcaptor");
            var myquery = { email: userInfo.email, password: userInfo.password };
            dbo.collection("Accounts").findOne(
                myquery,
                function (mdErr, mdRes) {
                    if (mdErr) {
                        res.send("err");
                        throw err;
                    }
                    
                    if (mdRes != null) {
                        
                        const userResponse = (({ _id, username, email, coins, cards, unlocks, auction }) => ({ _id, username, email, coins, cards, unlocks, auction }))(mdRes);
                        
                        db.close();
                        req.userInfo = userResponse;
                        next();
                        
                    }
                }
            );
        })
    });
};

app.get(
    "/user",
    middlewareValidarJWT,
    (req, res) => {
        res.json(req.userInfo);
    }
);

app.get("/auction", (req, res) => {
    
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) {
            res.send("err");
            throw err;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Auction")
            .find({ active: true })
            .toArray(function (error, result) {
                if (error) throw error;
                
                let bidsA = result[0].items[0].bids;
                bidsA.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsA.length; i++) {
                    bidsA[i].position = i+1;
                    bidsA[i].me = false;
                }
                if (bidsA.length > 5)
                    bidsA.length = 5
                
                let bidsB = result[0].items[1].bids;
                bidsB.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsB.length; i++) {
                    bidsB[i].position = i+1;
                    bidsB[i].me = false;
                }
                if (bidsB.length > 5)
                    bidsB.length = 5
                
                let bidsC = result[0].items[2].bids;
                bidsC.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsC.length; i++) {
                    bidsC[i].position = i+1;
                    bidsC[i].me = false;
                }
                if (bidsC.length > 5)
                    bidsC.length = 5
                
                result[0].hasMe = false;
                result[0].canBid = false;
                result[0].showButton = false;
                    
                res.status(200).json({ auction: result[0] });
                res.end();
                db.close();
            });
    });
    
})

app.post("/auctionLogged", (req, res) => {
    
    const username = req.body.username;
    
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) {
            res.send("err");
            throw err;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Auction")
            .find({ active: true })
            .toArray(function (error, result) {
                if (error) throw error;
                
                let hasMe = false;
                
                // FIRST
                let bidsAHasMe = false;
                let AbetweenFive = false;
                let AMyBid = {}
                let bidsA = result[0].items[0].bids;
                bidsA = bidsA.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsA.length; i++) {
                    bidsA[i].position = i+1;
                    if (bidsA[i].userName == username) {
                        bidsA[i].me = true;
                        bidsAHasMe = true;
                        hasMe = true;
                        if (i < 5) {
                            AbetweenFive = true;
                        }
                        AMyBid = bidsA[i]
                    } else {
                        bidsA[i].me = false;
                    }
                }
                
                if (bidsA.length > 5)
                    bidsA.length = 5
                    
                if (bidsAHasMe == true && AbetweenFive == false) {
                    bidsA.length = 6
                    bidsA[5] = AMyBid
                } 
                    
                result[0].items[0].bids = bidsA
                
                // SECOND
                let bidsBHasMe = false;
                let BbetweenFive = false;
                let BMyBid = {}
                let bidsB = result[0].items[1].bids;
                bidsB = bidsB.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsB.length; i++) {
                    bidsB[i].position = i+1;
                    if (bidsB[i].userName == username) {
                        bidsB[i].me = true;
                        bidsBHasMe = true;
                        hasMe = true;
                        if (i < 5) {
                            BbetweenFive = true;
                        }
                        BMyBid = bidsB[i]
                    } else {
                        bidsB[i].me = false;
                    }
                }
                
                if (bidsB.length > 5)
                    bidsB.length = 5
                    
                if (bidsBHasMe == true && BbetweenFive == false) {
                    bidsB.length = 6
                    bidsB[5] = BMyBid
                } 
                    
                result[0].items[1].bids = bidsB
                
                // THIRD
                let bidsCHasMe = false;
                let CbetweenFive = false;
                let CMyBid = {}
                let bidsC = result[0].items[2].bids;
                bidsC = bidsC.sort((a,b) => b.value - a.value)
                for (let i = 0; i < bidsC.length; i++) {
                    bidsC[i].position = i+1;
                    if (bidsC[i].userName == username) {
                        bidsC[i].me = true;
                        bidsCHasMe = true;
                        hasMe = true;
                        if (i < 5) {
                            CbetweenFive = true;
                        }
                        BMyBid = bidsC[i]
                    } else {
                        bidsC[i].me = false;
                    }
                }
                
                if (bidsC.length > 5)
                    bidsC.length = 5
                    
                if (bidsCHasMe == true && CbetweenFive == false) {
                    bidsC.length = 6
                    bidsC[5] = CMyBid
                } 
                    
                result[0].items[2].bids = bidsC
                
                result[0].hasMe = hasMe;
                if (hasMe == true) {
                    result[0].canBid = false;
                } else {
                    result[0].canBid = true;
                }
                result[0].showButton = true;
                
                res.status(200).json({ auction: result[0] });
                res.end();
                db.close();
            });
    });
})

app.post("/bid", middlewareValidarJWT, (req, res) => {
    
    const auctionItem = req.body.auction;
    const auctionId = req.body.auctionId;
    const bid = parseFloat(rando(100, "float")).toFixed(2);
    const userInfo = req.userInfo;
    
    MongoClient.connect(MONGODB_URL, function (MongoClientErr, db) {
        if (MongoClientErr) {
            res.send("err");
            throw MongoClientErr;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Auction")
            .find({ active: true })
            .toArray(function (error, result) {
                if (error) throw error;
                
                let hasMe = false;
                
                result[0].items[0].bids.map(bid => {
                    if (bid.userName == userInfo.username) {
                        hasMe = true;
                    }
                })
                
                result[0].items[1].bids.map(bid => {
                    if (bid.userName == userInfo.username) {
                        hasMe = true;
                    }
                })
                
                result[0].items[2].bids.map(bid => {
                    if (bid.userName == userInfo.username) {
                        hasMe = true;
                    }
                })
                
                if (hasMe == true) {
                    // Tem
                    res.status(201).json({ res: "user bidded" });
                    res.end();
                    db.close();
                    console.log("ME TEM!")
                } else {
                    // Não tem
                    const user = {
                        userId: userInfo._id,
                        userName: userInfo.username,
                        value: bid
                    }
                    
                    let updateDocument = ""
                    
                    if (auctionItem == 0) {
                        updateDocument = {$push: { "items.0.bids": user }};
                    } else if (auctionItem == 1) {
                        updateDocument = {$push: { "items.1.bids": user }};
                    } else if (auctionItem == 2) {
                        updateDocument = {$push: { "items.2.bids": user }};
                    }
                    
                    dbo.collection("Auction").updateOne({ _id: ObjectId(auctionId) }, updateDocument, function(updateErr, updateRes) {
                        if (updateErr) {
                            res.send("err");
                            throw updateErr;
                        }
                        
                        res.status(200).json({ value: bid });
                        res.end();
                        db.close();
                    });
                }
            });
    });
})

app.get("/rando", (req, res) => {
    res.status(200).json({ rando: rando(100, "float")})
})

http.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
});

let checkAuctionInterval = null;

let lastAuction = null

const checkAuction = () => {
    
    if (lastAuction == null) {
        console.log("loading auction...")
        MongoClient.connect(MONGODB_URL, function (MongoClientErr, db) {
            if (MongoClientErr) {
                res.send("err");
                throw MongoClientErr;
            }
            const dbo = db.db("Thecardcaptor");
            dbo.collection("Auction")
                .find({ active: true })
                .toArray(function (error, result) {
                    if (error) throw error;
                    
                    lastAuction = result[0]
                    db.close();
                });
        });
    } else {
        
        const millisecondsToAdd = lastAuction.auctionTime * 1000;

        const expiryDates = new Date(new Date(lastAuction.startedAt).valueOf() + millisecondsToAdd);
        
        const now = new Date().getTime();

        const distance = expiryDates.getTime() - now;

        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        if (days <= 0 && hours <= 0 && minutes <= 0 && seconds <= 0) {
            // AUCTION IS OVER!!!
            console.log("AUCTION IS OVER!")
            clearInterval(checkAuctionInterval);
            
            MongoClient.connect(MONGODB_URL, function (MongoClientErr, db) {
                if (MongoClientErr) {
                    res.send("err");
                    throw MongoClientErr;
                }
                const dbo = db.db("Thecardcaptor");
                dbo.collection("Auction").updateOne(
                    { _id: ObjectId(lastAuction._id) },
                    {
                        "$set": {
                            canBid: false,
                            showButton: false,
                        }
                    },
                    function(updateErr, updateRes) {
                        if (updateErr) {
                            res.send("err");
                            throw updateErr;
                        }
                        
                        console.log("Updated")
                        
                        // Get winners list
                        dbo.collection("Auction")
                        .find({ active: true })
                        .toArray(function (error, result) {
                            if (error) throw error;
                            
                            lastAuction = result[0]
                            
                            result[0].items.map(item => {
                                
                                const cardId = item.item._id.toHexString();
                                
                                let bids = item.bids.map(bid => { return bid })
                                if (bids.length > 5)
                                    bids.length = 2
                                
                                bids.map(bid => {
                                    dbo.collection("Accounts").findOne(
                                        { _id: ObjectId(bid.userId) },
                                        function (getUserErr, getUserRes) {
                                            if (getUserErr) {
                                                throw getUserErr;
                                            }
                                            
                                            const userCards = getUserRes.cards;
                                            if (userCards.includes(cardId)) {
                                                // Envia pros itens
                                                
                                                dbo.collection("Accounts").updateOne(
                                                    { _id: ObjectId(bid.userId) },
                                                    { "$push": {
                                                        items: cardId
                                                    }},
                                                    function (newItemErr, newItemRes) {
                                                        if (newItemErr) {
                                                            throw newItemErr;
                                                        }
                                                        
                                                        console.log("adicionado novo item para " +bid.userName)
                                                    }
                                                )
                                                
                                            } else {
                                                // Adiciona card
                                                dbo.collection("Accounts").updateOne(
                                                    { _id: ObjectId(bid.userId) },
                                                    { "$push": {
                                                        cards: cardId
                                                    }, function(pushCardErr, pushCardRes) {
                                                        if (pushCardErr) {
                                                            throw pushCardErr;
                                                        }
                                                        
                                                        console.log(bid.userName + " got a new card: " + cardId);
                                                    } }
                                                )
                                            }
                                        })
                                })
                            })
                            
                            newAuction();
                        });
                    });
            });
        }
    }
}

function newAuction() {
    
    console.log("Preparing a new auction to replace " + lastAuction._id)
    
    MongoClient.connect(MONGODB_URL, function (err, db) {
        if (err) {
            throw err;
        }
        const dbo = db.db("Thecardcaptor");
        dbo.collection("Cards")
            .find({})
            .toArray(function (error, result) {
                if (error) throw error;
                
                const lastCardsIds = lastAuction.items.map(item => {
                    return item.item._id.toHexString();
                })
                
                const cards = result;
                
                let newAuctionCards = [];
                while (newAuctionCards.length < 3) {
                    
                    const newCardIndex = rando(cards.length-1);
                    if (!lastCardsIds.includes(cards[newCardIndex]._id.toHexString()) && !newAuctionCards.includes(cards[newCardIndex])) {
                        newAuctionCards.push(cards[newCardIndex]);
                    }
                    
                }
                
                const today = new Date();
                const date = (today.getMonth()+1)+'-'+today.getDate()+'-'+today.getFullYear();
                const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
                const dateTime = date+' '+time + ' GMT-0300';
                
                let newAuctionInfo = {
                    active: true,
                    startedAt: dateTime,
                    auctionTime: 86400,
                    canBid: true,
                    showButton: true,
                    items: newAuctionCards.map(card => { return { item: card, bids: [] } })
                }
                
                dbo.collection("Auction").updateOne(
                    { _id: ObjectId(lastAuction._id) },
                    {
                        "$set": {
                            active: false,
                        }
                    },
                    function (updateLastErr, updateLastRes) {
                        if (updateLastErr) throw updateLastErr;
                        
                        dbo.collection("Auction").insertOne(newAuctionInfo, function (insertNewAuctionErr, insertNewAuctionRes) {
                            if (insertNewAuctionErr) throw insertNewAuctionErr;
                            
                            console.log("New auction created");
                            lastAuction = null;
                            checkAuctionInterval = setInterval(checkAuction, 2000)
                            
                            db.close();
                        });
                        
                    });
            });
    });
    
}

checkAuctionInterval = setInterval(checkAuction, 2000)