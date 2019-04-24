'use strict'

const mongoose = require('mongoose')
const async = require('async')
const config = require('./config')
const Schema = mongoose.Schema
const mongoosastic = require('../lib/mongoosastic')




const ParentSchema = new Schema({
  name: String,
  category: String
})
ParentSchema.plugin(
  mongoosastic,
  {
    index: 'nodes',
    join: {
      name: 'parentchild',
      self: 'parent',
      relations: {
        'parent':'child'
      }
    }
  }
)


const ChildSchema = new Schema({
  parent_id: {
    type: Schema.Types.ObjectId,
    // es_join_name: 'child',
    // es_join_isParentLink: true,
  },
  name: String,
  order: Number
})
ChildSchema.plugin(
  mongoosastic,
  {
    index: 'nodes',
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
    mongoose.connect(config.mongoUrl, function () {
      Parent.remove(function () {
        config.deleteIndexIfExists(['parents'], function () {
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
          async.forEach(rels, config.saveAndWaitIndex, function () {
            setTimeout(done, config.INDEXING_TIMEOUT)
          })
        })
      })
    })
  })

  after(function (done) {
    Parent.remove()
    Parent.esClient.close()
    mongoose.disconnect()
    done()
  })

  describe('Search', function () {
    it('if we find a parent node, we should get all children back as well', function (done) {
      Parent.search({
        query_string: {
          query: 'Commercial'
        }
      }, function (err, res) {

        console.log("Search Returned answer", err, res);

        res.hits.total.should.eql(1)
        res.hits.hits.forEach(function (node) {
          ['Parent'].should.containEql(node._source.name)
        })

        done()
      })
    })
  })
})
