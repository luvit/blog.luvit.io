/*globals domChanger, moment*/
window.addEventListener("load", function () {
"use strict";

function SearchApp(emit, refresh) {
  var matches = null, text = "", querying = false, xhr = null;

  var initialSearch = "*/";
  if (window.location.hash) {
    initialSearch = window.location.hash.substring(1);
  }
  search(initialSearch);

  window.onhashchange = function(evt) {
    var query = window.location.hash.substring(1);
    search(query);
  }

  return { render: render };

  function render() {
    return [["section.single",
      ["form", { onsubmit: handleSubmit },
        ["input", {
          onchange: onChange,
          value: text
        }],
        ["button", "Search"],
          matches === null ? "" :
            ["span", " " + matches.length + " match" + (matches.length === 1 ? "" : "es")]
      ]],
      (querying ? ["p", "Querying..."] : [SearchResults, matches, search])
    ];
  }

  function search(query) {
    if (!query || query.trim() === "") { query = "*" }
    if (xhr !== null) { xhr.onload = function() {} }
    querying = true;
    text = query
    matches = null;
    window.location.hash = query
    refresh();
    xhr = createCORSRequest("GET", "//lit.luvit.io/search/" + window.escape(text));
    if (!xhr) { throw new Error("Your browser doesn't appear to support CORS requests"); }
    xhr.send();
    xhr.onerror = function () {
      throw new Error("There was a problem making the request");
    };
    xhr.onload = function () {
      var result = JSON.parse(xhr.responseText);
      matches = [];
      querying = false;
      var keys = Object.keys(result.matches);
      for (var i = 0, l = keys.length; i < l; i++) {
        var key = keys[i];
        var match = result.matches[key];
        match.name = key;
        matches[i] = match;
      }
      matches.sort(function (a, b) {
        if (a.type !== b.type) {
          return b.type.localeCompare(a.type);
        }
        if (a.tagger) {
          return b.tagger.date.seconds - a.tagger.date.seconds;
        }
        return a.name.localeCompare(b.name);
      });
      refresh();
    };
  }

  function handleSubmit(evt) {
    evt.preventDefault();
    search(text);
  }

  function onChange(evt) {
    text = evt.target.value;
  }
}

function SearchResults() {
  return { render: render };
  function render(matches) {
    var type;
    var start = 0;
    return [matches.map(function (match, i) {
      if (match.type !== type) {
        type = match.type;
        start = i % 3;
      }
      var tag = "section.third.card";
      if (i % 3 === start) {
        tag += ".clear";
      }
      if (match.type === "package") {
        return [tag, [PackageCard, match]];
      }
      else if (match.type === "author") {
        return [tag, [PersonCard, match]];
      }
    })];
  }
}

function PersonCard() {
  return { render: render };
  function render(item) {
    var body = [["span.icon-library"], ["strong", item.name]];
    var rows = [];
    if (item.url) {
      rows.push([["span.icon-earth"], ["a", {href: "#" + item.name + "/"}, "Published Packages"]]);
    }
    body.push(["ul", rows.map(function (row) {
      return ["li"].concat(row);
    })]);

    return body;
  }
}

function PackageCard() {
  return { render: render };
  function render(item) {
    var matches = item.name.match(/(.*\/)([^\/]*)/);
    var body = [["span.icon-book"], ["a", {href: "#" + matches[1]}, matches[1]], ["a", {href: "#" + item.name}, ["strong", matches[2]]]];
    if (item.description) {
      body.push(["p", item.description]);
    }
    var rows = [];
    if (item.private) {
      rows.push([["span.icon-eye-blocked"], "Private Module"]);
    }
    if (item.homepage) {
      rows.push([["span.icon-earth"], ["a", {href: item.homepage}, "Homepage"]]);
    }
    if (item.version) {
      rows.push([["span.icon-price-tag"], "v" + item.version]);
    }
    if (item.tagger) {
      var tagger = item.tagger;
      var date = moment.unix(tagger.date.seconds).utcOffset(tagger.date.offset);
      var details = date.toString() + "\n" +
        tagger.name + " <" + tagger.email + ">";
      rows.push([["span.icon-calendar"], ["span",
        {title: details}, date.fromNow()]]);
    }
    if (item.license) {
      rows.push([["span.icon-hammer2"], item.license + " licenced"]);
    }
    if (item.author) {
      rows.push([["span.icon-user"], [Person, item.author]]);
    }
    if (item.contributors) {
      rows.push([["span.icon-users"], "Contributors:", ["ul", item.contributors.map(function (person) {
        return ["li", [Person, person]];
      })]]);
    }
    if (item.luvi) {
      var luvi = "Luvi: ";
      if (item.luvi.flavor) {
        luvi += " " + item.luvi.flavor;
      }
      if (item.luvi.version) {
        luvi += " v" + item.luvi.version;
      }
      rows.push([["span.icon-cog"], luvi]);
    }
    if (item.keywords) {
      rows.push([["span.icon-price-tags"], item.keywords.map(function (keyword) {
        var line = ["a.keyword", {href: "#" + keyword}, keyword];
        return line;
      })]);
    }
    if (item.dependencies) {
      rows.push([["span.icon-books"], "Dependencies:", ["ul", item.dependencies.map(function (dependency) {
        var match = dependency.match(/^(.*\/)([^\/@]+)(?:@(.*))?$/);
        var name = match[2];
        var line = ["li", ["a", {href: "#" + match[1] + match[2], title:dependency}, name]];
        if (match[3]) {
          line.push(" v" + match[3]);
        }
        return line;
      })]]);
    }
    body.push(["ul", rows.map(function (row) {
      return ["li"].concat(row);
    })]);

    return body;

  }
}

function Person() {
  return { render: render };
  function render(person) {
    if (typeof person === "string") {
      var match = person.match(/^(.*?) *(?:<([^>]+)>)?$/);
      if (match) {
        person = {
          name: match[1],
          email: match[2],
        };
      }
    }
    var line = person.name;
    if (person.email && !person.url) {
      person.url = "mailto:" + person.email;
    }
    if (person.url) {
      var attribs = {href: person.url};
      if (person.email) {
        attribs.title = person.email;
      }
      return ["a", attribs, line];
    }
    return ["span", line];
  }
}

var container = document.getElementById("lit-browser");
container.textContent = "";
domChanger(SearchApp, container).update();

function createCORSRequest(method, url) {
  var xhr = new XMLHttpRequest();
  if ("withCredentials" in xhr) {

    // Check if the XMLHttpRequest object has a "withCredentials" property.
    // "withCredentials" only exists on XMLHTTPRequest2 objects.
    xhr.open(method, url, true);

  } else if (typeof XDomainRequest !== "undefined") {

    // Otherwise, check if XDomainRequest.
    // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
    xhr = new XDomainRequest();
    xhr.open(method, url);

  } else {

    // Otherwise, CORS is not supported by the browser.
    xhr = null;

  }
  return xhr;
}


}, false);
