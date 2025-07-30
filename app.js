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
          connection.query('SELECT * FROM UserGames WHERE gameId = ?', [gameId], (error, UserOwnedGames) => {
            res.render('game', { game: results[0], userComments: comments, user: req.session.user, OwnedGame: UserOwnedGames });
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


app.post('/buy', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const gameId = req.body.gameId;
  const purchaseDate = new Date().toISOString().slice(0, 19).replace('T', ' '); // format: YYYY-MM-DD HH:MM:SS

  const sql = 'INSERT INTO UserGames (userId, gameId, purchaseDate) VALUES (?, ?, ?)';
  connection.query(sql, [userId, gameId, purchaseDate], (error, results) => {
    if (error) {
      console.error("Error adding game:", error);
      res.status(500).send('Error adding game');
    } else {
      res.redirect('/home');
    }
  });
});

app.post('/addComment', checkAuthenticated, (req, res) => {
  const userId = req.session.user.id;
  const gameId = req.body.gameId;
  const username = req.session.user.username;
  const comment = req.body.comment;

  connection.query(
    'INSERT INTO UserComments (userId, gameId, username, comment) VALUES (?, ?, ?, ?)', [userId, gameId, username, comment], (error, results) => {
      if (error) {
        console.error("Error adding comment:", error);
        res.status(500).send('Error adding comment');
      } else {
        res.redirect(`/game/${encodeURIComponent(req.body.title)}?id=${gameId}`);
      }
    }
  );
});


const PORT = process.env.PORT || 61002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));