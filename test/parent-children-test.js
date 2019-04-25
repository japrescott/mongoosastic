'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')




const ParentSchema = new Schema(
  {
    name: { type: String, es_indexed: true },
    category: { type: String, es_indexed: true },
  },
  {
    collection:"nodes"
  }
)
ParentSchema.plugin(
  mongoosastic,
  {
    index: 'nodes',
    hydrate: true,
    join: {
      name: 'parentchild',
      self: 'parent',
      relations: {
        'parent':'child'
      }
    }
  }
)


const ChildSchema = new Schema(
  {
    parent_id: {
      type: Schema.Types.ObjectId,
      es_indexed: true
      // es_join_name: 'child',
      // es_join_isParentLink: true,
    },
    name: { type: String, es_indexed: true },
    order: { type: Number, es_indexed: true },
  },
  {
    collection:"nodes"
  }
)
ChildSchema.plugin(
  mongoosastic,
  {
    index: 'nodes',
    hydrate: true,
    join: {
      name: 'parentchild',
      self: 'child',
      parentField: 'parent_id',
      relations: {
        'parent':'child'
      }
    }
  }
)

const Parent = mongoose.model('Parent', ParentSchema)
const Child = mongoose.model('Child', ChildSchema)

describe('Parent->Children', function () {
  before(function (done) {
    console.log("Before: making all documents..");
    mongoose.connect(config.mongoUrl, function () {
      Parent.remove(function () {
        config.deleteIndexIfExists(['nodes'], function () {
          Parent.createMapping(() => {
            //Child.createMapping(() => {
                
              const par = new Parent({
                name: 'Parent',
                category: 'A',
              });
              const rels = [
                par,
                new Child({
                  'parent_id':par._id,
                  name: 'Commercial',
                  order: 1
                }),
                new Child({
                  'parent_id':par._id,
                  name: 'Construction',
                  order: 5
                }),
                new Child({
                  'parent_id':par._id,
                  name: 'Legal',
                  order: 3
                })
              ]
              console.log("Before: created documents, saving..");
              async.eachSeries( rels, config.saveAndWaitIndex, function (err) {
                console.log('Before: saved and indexes all parent-> children documents', err)
                setTimeout(done, config.INDEXING_TIMEOUT)
              })
            //})
          })
        })
      })
    })
  })

  after(function (done) {
    Parent.deleteMany()
    Child.deleteMany()
    Parent.esClient.close()
    Child.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('Search', function () {

    it('find parent node', function (done) {
      Parent.search({
        query_string: {
          query: 'Parent'
        }
      }, function (err, res) {

        console.log("Search Returned answer", err, JSON.stringify(res, null, 4) );

        res.hits.total.should.eql(1)
        // res.hits.hits.forEach(function (node) {
        //   ['Parent'].should.containEql(node._source.name)
        // })

        done()
      })
    });

    it('find child node', function (done) {
      Child.search({
        query_string: {
          query: 'Commercial'
        }
      }, function (err, res) {

        console.log("Search Returned answer", err, JSON.stringify(res, null, 4) );

        res.hits.total.should.eql(1)
        // res.hits.hits.forEach(function (node) {
        //   ['Parent'].should.containEql(node._source.name)
        // })

        done()
      })
    });

    it('if we find a parent node, we should get all children back as well', function (done) {
      Parent.search({
        // simple_query_string: {
        //   query: 'Commercial'
        // }
        has_child: {
          type: "child",
          score_mode: "avg",
          query: {
            "match_all": {}
            // query_string:{
            //   query: 'Commercial'
            // }
          },
          "inner_hits": {}
        }
      }, function (err, res) {

        console.log("Search Returned answer", err, JSON.stringify(res, null, 4) );

        res.hits.total.should.eql(1)
        res.hits.hits.forEach(function (node) {
          ['Parent'].should.containEql(node._source.name)
        })

        done()
      })
    });


  })
})
