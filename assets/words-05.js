/* Unit 5 — Part 5: Incomplete Sentences.
   Core words are the Tactics for TOEIC Unit 5 word list (pp.172–173), the
   longest list in the early units. Supplements come from 600 Essential Words
   lessons 14 and 21 (salaries and benefits, banking) — Part 5 stems lean
   heavily on pay, money and company finance.
   Definitions and example sentences are the books' own, with one exception
   noted on `considerable` / `significant` below. */
Vocab.register(5, {
  unit: 5,
  part: "Part 5: Incomplete Sentences",
  kind: "reading",
  words: [
    { w: "accommodation", pos: "n", src: "tactics",
      def: "a place to live or stay",
      ex: "I'm looking for new accommodation, as my current place is too small.",
      gap: "I'm looking for new ___, as my current place is too small." },

    { w: "advantage", pos: "n", src: "tactics",
      def: "something that gives you a better chance of success than another person",
      ex: "His ability to speak French gave him an advantage over the other applicants.",
      gap: "His ability to speak French gave him an ___ over the other applicants." },

    { w: "aid", pos: "v", src: "tactics",
      def: "to assist people in need of help, especially by giving money",
      ex: "The government tries to aid health groups as much as possible.",
      gap: "The government tries to ___ health groups as much as possible." },

    { w: "considered", full: "(be) considered", pos: "v", src: "tactics",
      def: "thought by many people to be something",
      ex: "Adam Antoniotti is considered to be one of the most impressive designers in the fashion industry today.",
      gap: "Adam Antoniotti is ___ to be one of the most impressive designers in the fashion industry today." },

    /* The book defines `considerable` as "significant" and `significant` as
       "important, considerable", which would make these two unanswerable as
       a pair. Both definitions are reworded here; the examples are the
       book's own. */
    { w: "considerable", pos: "adj", src: "tactics",
      def: "large in amount or degree",
      ex: "The rise in steel prices has resulted in a considerable increase in production costs.",
      gap: "The rise in steel prices has resulted in a ___ increase in production costs." },

    { w: "convince", pos: "v", src: "tactics",
      def: "to persuade someone",
      ex: "He convinced me this was the right thing to do.",
      gap: "He ___ me this was the right thing to do." },

    { w: "courier", pos: "n", src: "tactics",
      def: "a person working for a delivery company who takes letters and packages from one place to another",
      ex: "What time does the courier come in the evenings?",
      gap: "What time does the ___ come in the evenings?" },

    { w: "credit", pos: "n", src: "tactics",
      def: "money available to borrow from banks or other financial institutions",
      ex: "Careless use of credit can lead to trouble sooner than you expect.",
      gap: "Careless use of ___ can lead to trouble sooner than you expect." },

    { w: "distribution", pos: "n", src: "tactics",
      def: "the way goods are delivered from the factory to the shops",
      ex: "The distribution of goods takes only a day or two.",
      gap: "The ___ of goods takes only a day or two." },

    { w: "donation", pos: "n", src: "tactics",
      def: "a gift, often of money, to a charity",
      ex: "The hostel relies on donations from the public.",
      gap: "The hostel relies on ___ from the public." },

    { w: "downturn", pos: "n", src: "tactics",
      def: "a change for the worse, usually in a country's or company's economic situation",
      ex: "The financial situation took a bit of a downturn but it has now improved.",
      gap: "The financial situation took a bit of a ___ but it has now improved." },

    { w: "efficiently", pos: "adv", src: "tactics",
      def: "well, without wasting time and resources",
      ex: "They worked very efficiently as a team and completed the work in record time.",
      gap: "They worked very ___ as a team and completed the work in record time." },

    { w: "emergency", pos: "n", src: "tactics",
      def: "a sudden and serious situation",
      ex: "In an emergency, press the red alarm button.",
      gap: "In an ___, press the red alarm button." },

    { w: "immediate", pos: "adj", src: "tactics",
      def: "without hesitation, connected to now",
      ex: "Is there any immediate action to be taken?",
      gap: "Is there any ___ action to be taken?" },

    { w: "impact", pos: "n", src: "tactics",
      def: "the effect one thing has on another",
      ex: "The growth of the tourist industry has a tremendous impact on the environment.",
      gap: "The growth of the tourist industry has a tremendous ___ on the environment." },

    { w: "improve", pos: "v", src: "tactics",
      def: "to make better",
      ex: "Customer service has improved considerably as a result of the new training programme.",
      gap: "Customer service has ___ considerably as a result of the new training programme." },

    { w: "influential", pos: "adj", src: "tactics",
      def: "having the ability to affect others",
      ex: "The news magazine published a list of the 100 most influential people in the world.",
      gap: "The news magazine published a list of the 100 most ___ people in the world." },

    { w: "intently", pos: "adv", src: "tactics",
      def: "with great concentration",
      ex: "I listened intently to the directions he gave me because I didn't want to get lost.",
      gap: "I listened ___ to the directions he gave me because I didn't want to get lost." },

    { w: "optimistic", pos: "adj", src: "tactics",
      def: "having a positive feeling about something",
      ex: "They were optimistic about the outcome of the negotiations.",
      gap: "They were ___ about the outcome of the negotiations." },

    { w: "process", pos: "v", src: "tactics",
      def: "to deal with",
      ex: "It took the accounts department a couple of days to process the invoice.",
      gap: "It took the accounts department a couple of days to ___ the invoice." },

    { w: "reach", pos: "v", src: "tactics",
      def: "to communicate with someone by telephone",
      ex: "I've been trying to reach him all day.",
      gap: "I've been trying to ___ him all day." },

    { w: "recommendation", pos: "n", src: "tactics",
      def: "a suggestion; something thought to be a good idea",
      ex: "What is your recommendation for the main course?",
      gap: "What is your ___ for the main course?" },

    { w: "retirement", pos: "n", src: "tactics",
      def: "the time when you stop work because you have reached a certain age",
      ex: "She was pleased with her retirement present.",
      gap: "She was pleased with her ___ present." },

    { w: "roughly", pos: "adv", src: "tactics",
      def: "approximately",
      ex: "You have to wait roughly 6 weeks for a refund.",
      gap: "You have to wait ___ 6 weeks for a refund." },

    { w: "select", pos: "v", src: "tactics",
      def: "to choose",
      ex: "Select a cell on the spreadsheet by clicking on it.",
      gap: "___ a cell on the spreadsheet by clicking on it." },

    { w: "significant", pos: "adj", src: "tactics",
      def: "important enough to have a noticeable effect",
      ex: "He noticed a significant change in his well-being once he started to eat healthily.",
      gap: "He noticed a ___ change in his well-being once he started to eat healthily." },

    { w: "simplify", pos: "v", src: "tactics",
      def: "to make something less complicated",
      ex: "We need to simplify our operations to reduce costs.",
      gap: "We need to ___ our operations to reduce costs." },

    { w: "suggest", pos: "v", src: "tactics",
      def: "to put forward an idea, to propose",
      ex: "I suggest we take a break and come back to this tomorrow after a good night's sleep.",
      gap: "I ___ we take a break and come back to this tomorrow after a good night's sleep." },

    { w: "underprivileged", pos: "adj", src: "tactics",
      def: "poor, with less money and fewer opportunities than most people in society",
      ex: "Charity should target the underprivileged.",
      gap: "Charity should target the ___." },

    { w: "welfare", pos: "n", src: "tactics",
      def: "money paid by the government to help those unable to help themselves",
      ex: "Welfare payments account for 25% of all taxes.",
      gap: "___ payments account for 25% of all taxes." },

    { w: "work-life balance", pos: "n", src: "tactics",
      def: "a situation where a person is happy with the amount of time they spend at work and not at work",
      ex: "A good work-life balance reduces stress.",
      gap: "A good ___ reduces stress." },

    { w: "eligible", pos: "adj", src: "600", lesson: "Lesson 14, Salaries and Benefits",
      def: "able to participate in something; qualified",
      ex: "Some employees may be eligible for the tuition reimbursement plan.",
      gap: "Some employees may be ___ for the tuition reimbursement plan." },

    { w: "compensate", pos: "v", src: "600", lesson: "Lesson 14, Salaries and Benefits",
      def: "to pay; to make up for",
      ex: "The company will compensate employees for any travel expenses.",
      gap: "The company will ___ employees for any travel expenses." },

    { w: "negotiate", pos: "v", src: "600", lesson: "Lesson 14, Salaries and Benefits",
      def: "to talk for the purpose of reaching an agreement, especially on prices or contracts",
      ex: "You must know what you want and what you can accept when you negotiate a salary.",
      gap: "You must know what you want and what you can accept when you ___ a salary." },

    { w: "deduct", pos: "v", src: "600", lesson: "Lesson 21, Banking",
      def: "to take away from a total; to subtract",
      ex: "By deducting the monthly fee from her checking account, Yi was able to make her account balance.",
      gap: "By ___ the monthly fee from her checking account, Yi was able to make her account balance." },

    { w: "transaction", pos: "n", src: "600", lesson: "Lesson 21, Banking",
      def: "a business deal",
      ex: "Banking transactions will appear on your monthly statement.",
      gap: "Banking ___ will appear on your monthly statement." },

    { w: "cautiously", pos: "adv", src: "600", lesson: "Lesson 21, Banking",
      def: "carefully, warily",
      ex: "Act cautiously when signing contracts and read them thoroughly first.",
      gap: "Act ___ when signing contracts and read them thoroughly first." }
  ]
});
