// https://vapour-library.onrender.com/
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path')
const app = express();

// cloudinary image storage (PAINFUL TO MAKE)
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'game-images',
    allowed_formats: ['jpg', 'png']
  }
});

const upload = multer({ storage: storage });


const connection = mysql.createConnection({
    host: '1yfliu.h.filess.io',
    user: 'VaporLibrary_ageeither',
    password: '1c070e7cfebcc8318f1c37f00fe7cef05f079dd3',
    database: 'VaporLibrary_ageeither',
    port: 61002
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));


app.use(flash());


// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});

app.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  } else {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
  }
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO Users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
  if (req.session.user) {
      return res.redirect('/');
  } else {
    res.render('login', { user: req.session.user, messages: req.flash('success'), errors: req.flash('error') });
  }
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM Users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'user' || req.session.user.role == 'admin' )
                res.redirect('/home');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/home', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;

  connection.query('SELECT * FROM UserGames WHERE userId = ?', [userId], (error, gamesOwned) => {
    if (error) throw error;
    const gamesId = gamesOwned.map(row => row.gameId);

    connection.query('SELECT * FROM advertisements', (error, ads) => {
      if (error) throw error;

      if (gamesId.length === 0) {
        return res.render('home', { games: [], user: req.session.user, adverts: ads });
      } else {
        connection.query('SELECT * FROM Games WHERE gameId IN (?)', [gamesId], (error, results) => {
          if (error) throw error;
          return res.render('home', { games: results, user: req.session.user, adverts: ads });
        });
      }
    });
  });
});


app.get('/vapourstore', checkAuthenticated, (req,res) => {
  // Fetch data from MySQL
    connection.query('SELECT * FROM Games', (error, results) => {
      if (error) throw error;
      res.render('vapourstore', { Games: results, user: req.session.user})
    });
});

app.get('/game/:title', checkAuthenticated, (req, res) => {
  const gameId = req.query.id

  if (!gameId) {
    return res.status(400).send('Game ID not found');
  }

  connection.query('SELECT * FROM Games WHERE gameId = ?', [gameId], (error, results) => {
      if (error) throw error;
      if (results.length > 0) {
        connection.query('SELECT * FROM UserComments WHERE gameId = ?', [gameId], (error, comments) => {
          connection.query('SELECT * FROM userGames WHERE gameId = ?', [gameId], (error, UserOwnedGames) => {
            res.render('game', { game: results[0], userComments: comments, user: req.session.user, UserOwnedGames: OwnedGame });
          });
        });
      } else {
        res.status(404).send('Game not found');
      }
  });
});

app.get('/addGame', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addGame', { user: req.session.user } ); 
});

app.post('/addGame', upload.single('image'), checkAuthenticated, checkAdmin, (req, res) => {
  const { title, price, desc, tag } = req.body;
  const imageUrl = req.file.path; // Cloudinary URL into DB

  const sql = 'INSERT INTO Games (title, price, `desc`, image, tag) VALUES (?, ?, ?, ?, ?)';
  connection.query(sql, [title, price, desc, imageUrl, tag], (error, results) => {
    if (error) {
      console.error("Error adding game:", error);
      res.status(500).send('Error adding game');
    } else {
      res.redirect('/vapourStore');
    }
  });
});


app.get('/editGame/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const gameId = req.params.id;
    const sql = 'SELECT * FROM Games WHERE gameId = ?';

    connection.query(sql , [gameId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            res.render('editGame', { game : results[0], user: req.session.user });
        } else {
            res.status(404).send('Game not found');
        }
    });
});

app.post('/editGame/:id', upload.single('image'), checkAuthenticated, checkAdmin, (req, res) => {
  const gameId = req.params.id;
  const { title, price, desc, tag } = req.body;
  const imageUrl = req.file ? req.file.url : null;

  let sql, params;
  if (imageUrl) {
    sql = 'UPDATE Games SET title = ?, price = ?, `desc` = ?, image = ?, tag =? WHERE gameId = ?';
    params = [title, price, desc, imageUrl, tag, gameId];
  } else {
    sql = 'UPDATE Games SET title = ?, price = ?, `desc` = ?, tag = ? WHERE gameId = ?';
    params = [title, price, desc, tag, gameId];
  }

  connection.query(sql, params, (error, results) => {
    if (error) {
      console.error("Error updating game:", error);
      return res.status(500).send('Error updating game');
    }
    res.redirect('/admin');
  });
});


app.get('/deleteGame/:id', checkAuthenticated, (req, res) => {
    const gameId = req.params.id;

    connection.query('DELETE FROM Games WHERE gameId = ?', [gameId], (error, results) => {
        if (error) {
            console.error("Error deleting game:", error);
            res.status(500).send('Error deleting game');
        } else {
            res.redirect('/admin');
        }
    });
});

app.get('/searchResults', checkAuthenticated, (req, res) => {
  res.render('searchResults', {user: req.session.user} );
});


app.post('/search', checkAuthenticated, (req, res) => {
  const searchQuery = req.body.query;
  const sqlQuery = 'SELECT * FROM Games WHERE title LIKE ?';
  const searchTerm = `%${searchQuery}%`;

  connection.query(sqlQuery, [searchTerm], (error, results) => {
    if (error) {
      console.error("Error finding game(s):", error);
      res.status(500).send('Error finding game(s)');
    } else {
      res.render('searchResults', {
        user: req.session.user,
        query: searchQuery,
        Games: results
      });
    }
  });
});

app.post('/tagSearch', checkAuthenticated, (req, res) => {
  const tag = req.body.tag;

  connection.query('SELECT * FROM Games WHERE tag = ?', [tag], (error, results) => {
    if (error) {
      console.error("Error finding game(s):", error);
      res.status(500).send('Error finding game(s)');
    } else {
      res.render('searchResults', {
        user: req.session.user,
        query: tag,
        Games: results
      });
    }
  });
});


app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  connection.query('SELECT * FROM Games', (error, results) => {
    if (error) throw error;
    res.render('admin', { Games: results, user: req.session.user})
  });
})


// -----------------------------------------------------------------------------------------------------

// let games = [
//   { id: 1, title: "Doki Doki Literature Club", publisher: "Team Salvato", imageUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaG5mOHYzbDFvdXJ0Y2tlZWtkM2ZvazZzbWE3em52Zm9sczV2aXE2MCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/kimYELmyrtIAd1TPFs/giphy.gif" },
//   { id: 2, title: "Path Of Exile", publisher: "Grinding Gear Games", imageUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLCBn8VYtbHkGlV2hHrPwlkEpl8_ebg7yQ2w&s" },
//   { id: 3, title: "Minecraft", publisher: "Microsoft", imageUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExY2ZwOGtocjc4cXY4ZGdleGRqOThrOHR6Z3FuZ24wcnVlaGo1bm4zciZlcD12MV9naWZzX3NlYXJjaCZjdD1n/NM4HoYcdbXdLO/giphy.gif" }
// ];

// let recentlyDeleted = null;
// let undoTimer = null;

// // Navbar rendering
// function renderNavbar() {
//   return `
//     <nav class="navbar navbar-expand-sm bg-dark navbar-dark">
//       <div class="container-fluid">
//         <ul class="navbar-nav">
//           <li class="nav-item">
//             <a class="nav-link"><b>Gerald's Gaming Library</b></a>
//           </li>
//           <li class="nav-item">
//             <a class="nav-link" href="/">Home</a>
//           </li>
//           <li class="nav-item">
//             <a class="nav-link" href="/games">Games</a>
//           </li>
//           <li class="nav-item">
//             <a class="nav-link" href="/addgames">Add Game</a>
//           </li>
//         </ul>
//       </div>
//     </nav>
//   `;
// }

// // Page wrapper
// function renderPage(title, content) {
//   return `
//     <!doctype html>
//     <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta name="viewport" content="width=device-width, initial-scale=1" />
//         <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" />
//         <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
//         <title>${title}</title>
//       </head>
//       <body class="bg-dark text-white">
//         ${renderNavbar()}
//         <div class="container mt-4">
//           ${content}
//         </div>
//       </body>
//     </html>
//   `;
// }

// Routes

app.get('/addgames', (req, res) => {
  const content = `
    <h1>Add a Game</h1>
    <form action="/addgames" method="POST">
      <div class="mb-3">
        <label for="title" class="form-label">Game Title:</label>
        <input id="title" name="title" placeholder="Game Title" class="form-control" required />
      </div>
      <div class="mb-3">
        <label for="publisher" class="form-label">Publisher:</label>
        <input id="publisher" name="publisher" placeholder="Publisher" class="form-control" required />
      </div>
      <div class="mb-3">
        <label for="imageUrl" class="form-label">Image URL:</label>
        <input id="imageUrl" name="imageUrl" placeholder="Image URL (optional)" class="form-control" />
      </div>
      <button type="submit" class="btn btn-primary">Add Game</button>
    </form>
  `;
  res.send(renderPage("Add Game", content));
});

app.post('/addgames', (req, res) => {
  const newId = games.length ? Math.max(...games.map(g => g.id)) + 1 : 1;
  games.push({
    id: newId,
    title: req.body.title,
    publisher: req.body.publisher,
    imageUrl: req.body.imageUrl || ''
  });
  res.redirect('/games');
});

app.get('/games', (req, res) => {
  const sql = 'SELECT * FROM games';
  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving games');
    }
    res.render('games', { games: results });
  });
});

//   let listItems = games.map(game => `
//     <li class="list-group-item bg-secondary text-white">
//       <strong>${game.title}</strong> (Publisher: ${game.publisher})<br>
//       ${game.imageUrl ? `<img src="${game.imageUrl}" class="img-thumbnail mb-2" style="max-width: 200px;" alt="${game.title} Cover" />` : ''}
//       <form action="/editgames/${game.id}" method="GET" class="d-inline me-2">
//         <button class="btn btn-success btn-sm mt-2" type="submit">Edit</button>
//       </form>
//       <form action="/deletegames/${game.id}" method="POST" class="d-inline">
//         <button class="btn btn-danger btn-sm mt-2" type="submit">Delete</button>
//       </form>
//     </li>
//   `).join('');

//   const content = `
//     <h1>Game List</h1>
//     <ul class="list-group">
//       ${listItems}
//     </ul>
//   `;

//   res.send(renderPage("Game List", content));
// });

app.get('/editgames/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const game = games.find(g => g.id === id);

  if (!game) {
    return res.send(renderPage("Game Not Found", `
      <p>Game not found.</p>
      <a href="/games" class="btn btn-secondary">Back to List</a>
    `));
  }

  const content = `
    <h1>Edit Game</h1>
    <form action="/editgames/${game.id}" method="POST">
      <div class="mb-3">
        <label for="title" class="form-label">Game Title:</label>
        <input id="title" name="title" value="${game.title}" class="form-control" required />
      </div>
      <div class="mb-3">
        <label for="publisher" class="form-label">Publisher:</label>
        <input id="publisher" name="publisher" value="${game.publisher}" class="form-control" required />
      </div>
      <div class="mb-3">
        <label for="imageUrl" class="form-label">Image URL:</label>
        <input id="imageUrl" name="imageUrl" value="${game.imageUrl || ''}" class="form-control" />
      </div>
      <button type="submit" class="btn btn-primary">Update Game</button>
    </form>
    <a href="/games" class="btn btn-secondary mt-3">Back to List</a>
  `;
  res.send(renderPage("Edit Game", content));
});

app.post('/editgames/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const game = games.find(g => g.id === id);

  if (game) {
    game.title = req.body.title;
    game.publisher = req.body.publisher;
    game.imageUrl = req.body.imageUrl;
  }

  res.redirect('/games');
});

app.post('/deletegames/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = games.findIndex(g => g.id === id);

  if (index !== -1) {
    recentlyDeleted = games[index];
    games.splice(index, 1);

    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      recentlyDeleted = null;
    }, 10000);

    res.redirect('/undo');
  } else {
    res.redirect('/games');
  }
});

app.get('/undo', (req, res) => {
  let content = `<h1>Game Deleted</h1>`;

  if (recentlyDeleted) {
    content += `
      <p><strong>${recentlyDeleted.title}</strong> was deleted.</p>
      <form action="/restore" method="POST">
        <button class="btn btn-warning">Undo Delete</button>
      </form>
      <p class="mt-2 text-muted">This option will expire in 10 seconds.</p>
    `;
  } else {
    content += "<p>Undo period has expired.</p>";
  }

  res.send(renderPage("Undo Delete", content));
});

app.post('/restore', (req, res) => {
  if (recentlyDeleted) {
    games.push(recentlyDeleted);
    recentlyDeleted = null;
    clearTimeout(undoTimer);
  }
  res.redirect('/games');
});
// -------------CART ------------------- //
app.use((req, res, next) => {
  if (!req.session.cart) {
    req.session.cart = [];
  }
  next();
});

app.get('/cart', checkAuthenticated, (req,res) => {
  res.render('cart', {
    user: req.session.user, 
    cart: req.session.cart,
    messages: req.flash('Success')
  });
});

app.post('/addcart', checkAuthenticated, (req, res) =>  {
  const { gameId, productName, price, image} = req.body;
  let cart = req.session.cart;
  let found = false;

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].gameId == gameId) {
      cart[i].quantity += 1;
      found = true;
      break;
    }
  }

  if (!found) {
    cart.push({
      gameId: gameId,
      productName: productName,
      price: parseFloat(price),
      image: image,
      quantity: 1
    });
  }

  res.redirect('/cart');
});

app.post('/removefromcart', checkAuthenticated, (req, res) => {
  const { gameId } = req.body;

  const cart = req.session.cart;

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].gameId === gameId) {
      cart.splice(i, 1);
      break;
    }
  }

  res.redirect('/cart');
});

app.post('/checkout', checkAuthenticated, (req,res) => {
  req.session.cart = [];
  req.flash('Success', 'Checkout successful! Thank you for your purchase.');
  res.redirect('/cart');
});
//-------------CART ------------------- //


const PORT = process.env.PORT || 61002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// TEST COMMIT