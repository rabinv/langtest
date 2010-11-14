var TranslatorDummy = function() {
  var translateFew = function(from, to, words, callback) {
    setTimeout(function() {
      var trans = {};

      for (var i = 0; i < words.length; i++) {
        trans[words[i]] = words[i] + from + '|' + to;
      }

      callback(trans);
    }, 500);
  };

  var translate = function(from, to, words, text, callback) {
    while (words.length) {
      var few = words.splice(0, 15);
      translateFew(from, to, few, callback);
    }
  };

  return {
    translate: translate
  };
};

var TranslatorGoogle = function() {
  var translateFew = function(from, to, words, callback) {
    var url = 'http://ajax.googleapis.com/' +
              'ajax/services/language/translate?v=1.0';

    url += '&langpair=' + from + '|' + to;

    for (var i = 0; i < words.length; i++) {
      url += '&q=' + encodeURI(words[i]);
    }

    $.ajax({url: url,
            async: true,
            dataType: 'json',
            success: function(data) {
              var resp = data.responseData;
              var trans = {};
              var result;

              if (resp.length) {
                for (var i = 0; i < resp.length; i++) {
                  result = resp[i].responseData.translatedText;
                  trans[words[i]] = result;
                }
              } else {
                trans[words[0]] = resp.translatedText;
              }

              callback(trans);
            }
    });
  };

  var realTranslate = function(from, to, words, callback) {
    while (words.length) {
      var few = words.splice(0, 15);
      translateFew(from, to, few, callback);
    }
  };

  var detectLang = function(text, callback) {
    var url = 'http://ajax.googleapis.com/' +
              'ajax/services/language/detect?v=1.0';

    url += '&q=' + encodeURI(text);

    $.ajax({url: url,
            async: true,
            dataType: 'json',
            success: function(data) {
              callback(data.responseData.language);
            }
    });
  };

  var translate = function(from, to, words, text, callback) {
    detectLang(text, function(lang) {
      realTranslate(lang, to, words, callback);
    });
  }

  return {
    translate: translate
  };
};
