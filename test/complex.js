var person = {
  identifier: { type: 'Text' },
  name: { type: 'Text' },
  cname: {
    type: 'Text',
    computed: ['name', function (name) {
      if (name === null) { return null; }
      return 'c' + name;
    }]
  },
  birthDate: { type: 'Date' }
};

// member (subscription)
// http://app_domain/groups/2/members/5
// http://app_domain/persons/8/members/5
// or http://app_domain/members/5 - independent entity
var member = {
  // subscription_id: http://app_domain/members/345
  identifier: { type: 'Integer' },

  cid: {
    type: 'Text',
    computed: ['identifier', function (identifier) {
      if (identifier === null) { return null; }
      return 'c' + identifier;
    }]
  },
  // when this subscription is created
  created: { type: 'Date' },
  level: { type: 'Integer' }, // level in current group
  // person_reference: 'http://app_domain/persons/234', type 'String'
  person: {
    type: 'Item', // usually it is a person_id, just address to some place, type: 'Integer'|'String'
    ref: person, // from 'persons' table foreign key
    table: 'persons'
  }
  // group_reference: 'http://app_domain/groups/456'
  // type: 'URL', name: 'Group', ref: 'groups'
};

var group = {
  identifier: { type: 'Text' },

  name: { type: 'Text' },

  // select * from members where group_id = id (group_ref = this)
  // <div itemprop="members" itemscope itemtype="ItemList">
  //   <div itemprop="ItemListElement" itemscope itemtype="Member">
  members: {
    type: 'ItemList',
    // schema: 'Member',
    ref: member
  },

  // insert into persons (id, name) values (3, 'Jane')
  // insert into members (id, person_id, group_id) values (1, 3, id)

  // or insert into group.members (id, person) values (1, {3, 'Jane'})
  // <div itemprop="captain" itemscope itemtype="Member">
  captain: {
    type: 'Item', // or 'Scope'
    // schema: 'Member',
    ref: member // use schema.get('Member')
  }

  // teachers, etc.
};

module.exports = {
  groups: {
    type: 'ItemList',
    ref: group
  },
  persons: {
    type: 'ItemList',
    ref: person
  }
  // members: {
  //   type: 'ItemList',
  //   ref: member
  // }
};
