// From PHP.js.  Dual MIT/GPL (http://phpjs.org/pages/license)
// http://phpjs.org/functions/levenshtein:463
function levenshtein(s1, s2) {
  // http://kevin.vanzonneveld.net
  // +  original by: Carlos R. L. Rodrigues (http://www.jsfromhell.com)
  // +  bugfixed by: Onno Marsman
  // +   revised by: Andrea Giammarchi (http://webreflection.blogspot.com)
  // + reimplemented by: Brett Zamir (http://brett-zamir.me)
  // + reimplemented by: Alexander M Beedie

  if (s1 == s2) {
    return 0;
  }

  var s1_len = s1.length;
  var s2_len = s2.length;
  if (s1_len === 0) {
    return s2_len;
  }
  if (s2_len === 0) {
    return s1_len;
  }

  var v0 = new Array(s1_len + 1);
  var v1 = new Array(s1_len + 1);

  var s1_idx = 0, s2_idx = 0, cost = 0;
  for (s1_idx = 0; s1_idx < s1_len + 1; s1_idx++) {
    v0[s1_idx] = s1_idx;
  }
  var char_s1 = '', char_s2 = '';
  for (s2_idx = 1; s2_idx <= s2_len; s2_idx++) {
    v1[0] = s2_idx;
    char_s2 = s2[s2_idx - 1];

    for (s1_idx = 0; s1_idx < s1_len; s1_idx++) {
      char_s1 = s1[s1_idx];
      cost = (char_s1 == char_s2) ? 0 : 1;
      var m_min = v0[s1_idx + 1] + 1;
      var b = v1[s1_idx] + 1;
      var c = v0[s1_idx] + cost;
      if (b < m_min) {
        m_min = b; }
      if (c < m_min) {
        m_min = c; }
      v1[s1_idx + 1] = m_min;
    }
    var v_tmp = v0;
    v0 = v1;
    v1 = v_tmp;
  }
  return v0[s1_len];
}

var BackendChrome = function() {
  var port = chrome.extension.connect();
  var theCallback; // ugly

  // we need to use a port for translation because
  // we can get multiple responses for a single request
  port.onMessage.addListener(function(msg) {
    theCallback(msg.trans);
  });

  var invoke = function(action, request, callback) {
    if (request == null)
      request = {};

    request.action = action;
    chrome.extension.sendRequest(request, callback);
  };

  return {
    getOptions: function(callback) {
      invoke('getOptions', null, function(response) {
        callback(response.options);
      });
    },

    translate: function(from, to, words, text, callback) {
      var request = {
        from: from,
        to: to,
        words: words,
        text: text
      };

      theCallback = callback;
      port.postMessage(request);
    }
  };
};

var words = function() {
  var regex = /([A-Za-z\u0080-\u00FF-]*)( ?)(?![^<]*>)/g;
  // var regex = /(([A-Za-z\u0080-\u00FF-]*)( ?))*[,.;:](?![^<]*>)/g;
  // var regex = /(.*?[,.;:](?![^<]*>))/g;
  // var regex = /(([A-Za-z\u0080-\u00FF-]+ ){2}
  // [A-Za-z\u0080-\u00FF-]+)(?![^<]*>)/g;
  var trans = {};
  var words = [];
  var seen = [];
  var backend = (chrome && chrome.extension) ?
                BackendChrome() : BackendDummy();

  var replaceHtml = function(html, options) {
    return html.replace(regex, function(m, a, rest) {
        var translation = trans[a];
        var rep;
        var index;
        var size;
        var val;

        if (translation === undefined || translation == a) {
          return a + rest;
        }

        if ($.inArray(a, seen) != -1) {
          return a + rest;
        }

        seen.push(a);

        size = a.length / 1.5;

        words.push(a);
        val = a.substr(0, 1);
        index = words.length - 1;

        style = 'width:' + size + 'em;';
        if (chrome && chrome.extension) {
          // URL in CSS file doesn't work when we're a Chrome
          // extension
          style += 'background-image: url(' +
               chrome.extension.getURL('back.png') + ');';
        }

        rep = '<span class="word">';
        rep += '<input type="text" id="word-' + index + '"';
        rep += ' style="' + style + '"';
        rep += ' placeholder="' + translation + '"';
        rep += ' value="' + val + '"></input>';
        rep += ' <em>(' + translation + ')</em></span>';

        return rep + rest;
        // return rep;
    });
  };

  var installHooks = function() {
    var i;

    for (i = 0; i < words.length; i++) {
      // we use keypress in addition to keyup because keyup sometimes
      // doesn't fire on this element if we immediately tab to the next

      $('#word-' + i).keypress(checkPress);
      $('#word-' + i).keyup(checkUp);
    }
  };

  var handleSel = function(range, span, newTrans, options) {
    $.extend(trans, newTrans);

    span.innerHTML = replaceHtml(span.innerHTML, options);

    range.deleteContents();
    range.insertNode(span);

    installHooks();
  };

  var handleEl = function(el, newTrans, options) {
    $.extend(trans, newTrans);

    el.html(replaceHtml(el.html(), options));

    installHooks();
  };

  var process = function(text, callback) {
    backend.getOptions(function(options) {
      var excerpt = text.substring(0, 100);
      var selected = [];

      var selectWord = function(word) {
        return word.length > options.minlen &&
             (Math.random() * 100 < options.percent);
      };

      text.replace(regex, function(m, a, rest) {
        if (selectWord(a))
          selected.push(a);
      });

      backend.translate('', options.lang, selected, excerpt,
                function(trans) {
        callback(trans, options);
      });
    });
  };

  // this is needed because word ids are not assigned in order
  var focusNext = function(el) {
    var inputs = $("input[id^='word-']");
    var next = false;
    var i;

    for (i = 0; i < inputs.length; i++) {
      if (next) {
        $(inputs[i]).focus();
        break;
      }

      if (inputs[i].id == el.id) {
        next = true;
      }
    }
  };

  var checkPress = function(e) {
    var enter = e.which == 13;
    var guess = e.target.value;

    if (!enter) {
      guess += String.fromCharCode(e.which);
    }

    check(e, guess);
  };

  var checkUp = function(e) {
    if (e.which == 13) {
      // Ignore Enter to prevent hopping which occurs when we jump to the
      // next element on keypress of one element, causing the keyUp to
      // trigger on the next element, incorrectly
      return;
    }

    check(e, e.target.value);
  };

  var check = function(e, guess) {
    var el = e.target;
    var index = parseInt(el.id.split('-')[1], 10);
    var answer = words[index];
    var enter = e.which == 13;
    var cheat = false;
    var correct = guess == answer;

    if (!correct && enter) {
      el.value = answer;
      guess = answer;
      correct = true;
      cheat = true;
    }

    if (correct && el.className == 'cheat') {
      // editying an already cheated field
      cheat = true;
    }

    el.className = cheat ? 'cheat' : (correct ? 'correct' : 'wrong');

    var lev = levenshtein(answer, guess);
    var totalWidth = $(el).width();
    var pos = totalWidth - lev * (totalWidth / answer.length);

    $(el).css('background-position', pos);

    if (correct && enter) {
      focusNext(el);
    }
  };

  var processElement = function(el) {
    process(el.html(), function(trans, options) {
      handleEl(el, trans, options);
    });
  };

  var processSelection = function() {
    var selection = window.getSelection();

    if (!selection.rangeCount) {
      return;
    }

    var range = selection.getRangeAt(0);
    var contents = range.cloneContents();
    var span = document.createElement('span');
    var text = contents.textContent;

    span.appendChild(contents);

    process(text, function(trans, options) {
      handleSel(range, span, trans, options);
    });
  };

  return {
    processElement: processElement,
    processSelection: processSelection
  };
}();
