// https://vapor-library.onrender.com/
const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
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
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
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
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
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

app.get('/home',  (req, res) => {
    res.render('home', {user: req.session.user} );
});

app.get('/vapourstore', (req,res) => {
  res.render('vapourstore', { Games: results, user: req.session.user})
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

app.get('/vapourstore', checkAuthenticated, (req, res) => {
  connection.query('*SELECT* FROM Games', (error, results) => {
    if (error) throw error;
    res.render('vapourstore', { user: req.session.user, Games:results });
  })
});



const PORT = process.env.PORT || 61002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// TEST COMMIT