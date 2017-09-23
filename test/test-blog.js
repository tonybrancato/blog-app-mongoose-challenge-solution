const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {DATABASE_URL} = require('../config');
const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

function tearDownDb() {
  console.warn('Deleting database');
  return mongoose.connection.dropDatabase();
}

function seedBlogData() {
  console.info('seeding blog data');
  const seedData = [];

  for (let i=1; i<=10; i++) {
    seedData.push(generateBlogData());
  }
  // this will return a promise
  return BlogPost.insertMany(seedData);
}

function generateBlogData() {
	console.info('seeding post data');
  return {
    author: {
    	firstName: faker.name.firstName(),
    	lastName: faker.name.lastName()
    },
    title: faker.lorem.sentence(),
    content: faker.lorem.text(),
	}
}

describe('Blog API resource', function() {

  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedRestaurantData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

describe('GET endpoint', function() {

  it('should return all existing blog posts', function() {
    // strategy:
    //    1. get back all blog psots returned by by GET request to `/posts`
    //    2. prove res has right status, data type
    //    3. prove the number of blog posts we got back is equal to number
    //       in db.
    //
    // need to have access to mutate and access `res` across
    // `.then()` calls below, so declare it here so can modify in place
    let res;
    return chai.request(app)
      .get('/posts')
      .then(function(_res) {
        // so subsequent .then blocks can access resp obj.
        res = _res;
        res.should.have.status(200);
        // otherwise our db seeding didn't work
        res.body.should.have.length.of.at.least(1);
        return BlogPost.count();
      })
      .then(function(count) {
        res.body.should.have.length.of(count);
      });
  });


  it('should return restaurants with right fields', function() {
    // Strategy: Get back all restaurants, and ensure they have expected keys

    let resBlogPosts;
    return chai.request(app)
      .get('/posts')
      .then(function(res) {
        res.should.have.status(200);
        res.should.be.json;
        res.body.should.be.a('array');
        res.body.should.have.length.of.at.least(1);
        res.body.forEach(function(post) {
          post.should.be.a('object');
          post.should.include.keys('content', 'title', 'author', 'id', 'created');
        });
        resBlogPosts = res.body[0];
        return BlogPost.findById(resBlogPosts.id);
      })
      .then(function(post) {
        resBlogPosts.author.should.equal(BlogPost.author);
        resBlogPosts.title.should.equal(BlogPost.title);
        resBlogPosts.content.should.equal(BlogPost.content);
      });
  });
});

describe('POST endpoint', function() {
// strategy: make a POST request with data,
// then prove that the post we get back has
// right keys, and that `id` is there (which means
// the data was inserted into db)
  it('should create a new blog post', function() {
    const newPost = generateBlogData();

    return chai.request(app)
      .post('/posts')
      .send(newPost)
      .then(function(res) {
        res.should.have.status(201);
        res.should.be.json();
        res.body.should.be.a('object');
        res.body.should.include.keys('content', 'title', 'author', 'id', 'created');
        res.body.title.should.equal(newPost.title);
        res.body.id.should.not.be.null;
        res.body.author.should.be.equal(newPost.author);
        res.body.content.should.be.equal(newPost.content);
        return BlogPost.findById(res.body.id);
      })
      .then(function(post){
        post.title.should.equal(newPost.title);
        post.content.should.equal(newPost.content);
        post.author.firstName.should.equal(newPost.author.firstName);
        post.author.lastName.should.equal(newPost.author.lastName);
      });
  });	

  describe('PUT endpoint', function() {
    //stratedgy: make a PUT request with data,
    //then prove that the post we get back has
    //the updated keys
    it('should update the specified fields', function() {
      const updatePost = {
        title: 'How to craft RESTful APIs',
        content: 'go to Thinkful'
      };
      return BlogPost
        .findOne()
        .then(function(post) {
          updatePost.id = post.id
          return chai.request(app)
            .put(`/posts/${post.id}`)
            .send(updatePost);
        })
        .then(function(res) {
          res.should.have.status(204);

          return BlogPost.findById(updatePost.id);
        })			
        .then(function(post) {
          post.title.should.equal(updatePost.title);
          post.content.should.equal(updatePost.content);
        })
    });
  });
  describe('DELETE endpoints', function() {
    // strategy:
    // 1. make a post
    // 2. make a delete request for the post's ID
    // 3. check status code
    // 4. prove that it no longer exists
    it('delete a blog post by id', function() {
      let post;
      return BlogPost
        .findOne()
        .then(function(_post) {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(function(_post) {
          should.not.exist(_post);
        });
    });
  });
});
});
