import {
  Artwork,
  Collaboration,
  Commission,
  Conversation,
  Message,
  Notification,
  Order,
  PortfolioProject,
  Review,
  User,
} from "../models";

const seedCreators = [
  {
    _id: "riya",
    firebaseUid: "demo-riya",
    name: "Riya Mehta",
    email: "riya.demo@example.test",
    college: "Srishti Manipal Institute",
    location: "Bengaluru, India",
    bio: "I build little worlds from city lights, rainy evenings and the things we almost miss.",
    skills: ["Digital painting", "Illustration", "Concept art", "Photoshop"],
    followers: 2480,
    rating: 4.9,
    totalSales: 34,
    totalViews: 18420,
  },
  {
    _id: "arjun",
    firebaseUid: "demo-arjun",
    name: "Arjun Nair",
    email: "arjun.demo@example.test",
    college: "MIT Institute of Design",
    location: "Pune, India",
    bio: "Character illustrator finding the strange and tender in the everyday.",
    skills: ["Character design", "Anime", "Procreate", "Storyboarding"],
    followers: 1820,
    rating: 4.8,
    totalSales: 26,
    totalViews: 10100,
  },
  {
    _id: "kavya",
    firebaseUid: "demo-kavya",
    name: "Kavya Rao",
    email: "kavya.demo@example.test",
    college: "National Institute of Design",
    location: "Ahmedabad, India",
    bio: "Making colour stories for a world that could use a little more wonder.",
    skills: ["Graphic design", "Poster art", "Typography", "Figma"],
    followers: 3200,
    rating: 5,
    totalSales: 43,
    totalViews: 14820,
  },
  {
    _id: "ishan",
    firebaseUid: "demo-ishan",
    name: "Ishan Shah",
    email: "ishan.demo@example.test",
    college: "IDC School of Design",
    location: "Mumbai, India",
    bio: "Visual explorations of architecture, memory and the cities we carry.",
    skills: ["3D art", "Photography", "Blender", "Environment design"],
    followers: 1120,
    rating: 4.7,
    totalSales: 14,
    totalViews: 7200,
  },
  {
    _id: "mira",
    firebaseUid: "demo-mira",
    name: "Mira Thomas",
    email: "mira.demo@example.test",
    college: "Srishti Manipal Institute",
    location: "Bengaluru, India",
    bio: "Soft surrealism, botanical forms and fragments of imagined places.",
    skills: ["Illustration", "Animation", "Digital painting", "Procreate"],
    followers: 940,
    rating: 4.9,
    totalSales: 13,
    totalViews: 8900,
  },
  {
    _id: "dev",
    firebaseUid: "demo-dev",
    name: "Dev Malhotra",
    email: "dev.demo@example.test",
    college: "Pearl Academy",
    location: "New Delhi, India",
    bio: "Designing visual identities with a pulse and a point of view.",
    skills: ["Graphic design", "UI/UX", "Branding", "Figma"],
    followers: 1670,
    rating: 4.8,
    totalSales: 20,
    totalViews: 8300,
  },
  {
    _id: "demo-buyer",
    firebaseUid: "demo-buyer",
    name: "Aarav Demo",
    email: "buyer.demo@example.test",
    college: "ARTNEST Demo Studio",
    location: "India",
    bio: "",
    skills: [],
    followers: 0,
    rating: 0,
    totalSales: 0,
    totalViews: 0,
    role: "buyer",
  },
];

const artSeed = [
  ["neon-mumbai", "Neon Mumbai", "riya", "Digital Painting", "Cyberpunk", 999, "A love letter to the city after the rain. Neon spills across familiar streets, where the night feels endless and every window holds a story.", ["Mumbai", "Nightscape", "Neon"], "art-neon-mumbai.jpg", 842, 12400],
  ["cyberpunk-girl", "Cyberpunk Girl", "arjun", "Illustration", "Anime", 1250, "A quiet portrait of a future that still feels human. Made with layered digital brushwork and a palette of electric violet.", ["Character", "Anime", "Portrait"], "art-cyberpunk.jpg", 729, 10100],
  ["monsoon-dreams", "Monsoon Dreams", "mira", "Digital Painting", "Realistic", 850, "A small pause in the middle of a big rain. A study in softness, silver skies, and the comfort of getting lost.", ["Monsoon", "Dreamscape", "Fine art"], "art-monsoon.jpg", 641, 8900],
  ["midnight-memories", "Midnight Memories", "kavya", "Posters", "Minimal", 1100, "A nocturnal poster study that turns fleeting memories into a vivid, layered landscape.", ["Poster", "Night", "Print"], "art-bloom.jpg", 588, 7700],
  ["lost-in-tokyo", "Lost in Tokyo", "ishan", "Photography", "Realistic", 1400, "Fragments of a sleepless city, captured between the last train and the first light.", ["Tokyo", "City", "Photo"], "art-neon-mumbai.jpg", 520, 7200],
  ["digital-bloom", "Digital Bloom", "mira", "Illustration", "Abstract", 920, "Wild forms, impossible colour and a garden that only exists when you look at it.", ["Botanical", "Surreal", "Colour"], "art-bloom.jpg", 488, 6900],
  ["mumbai-after-dark", "Mumbai After Dark", "riya", "Digital Painting", "Cyberpunk", 1500, "The city does not sleep. It changes its shape, and for a moment it belongs to dreamers.", ["Mumbai", "Cityscape", "Neon"], "art-neon-mumbai.jpg", 460, 6600],
  ["cosmic-wanderer", "Cosmic Wanderer", "arjun", "Illustration", "Anime", 1050, "A traveller, a distant star and the long way home. An original character study in deep space.", ["Space", "Character", "Fantasy"], "art-cyberpunk.jpg", 410, 6200],
  ["urban-dreams", "Urban Dreams", "dev", "Graphic Design", "Minimal", 780, "A typographic city poem about finding your own quiet in a crowded place.", ["Urban", "Typography", "Print"], "art-monsoon.jpg", 378, 5800],
  ["pastel-reality", "Pastel Reality", "kavya", "Posters", "Abstract", 890, "A colour study that lets soft geometry and playful forms share the same page.", ["Pastel", "Colour", "Poster"], "art-bloom.jpg", 342, 5400],
];

export async function seedDemoData(): Promise<void> {
  for (const creator of seedCreators) {
    await User.updateOne(
      { _id: creator._id },
      {
        $setOnInsert: {
          ...creator,
          role: creator.role || "student_creator",
          verificationStatus: "VERIFIED",
          commissionAvailable: true,
          isDemo: true,
        },
      },
      { upsert: true },
    );
  }

  for (const [index, row] of artSeed.entries()) {
    const [id, title, creatorId, category, style, price, description, tags, image, likes, views] = row as [
      string, string, string, string, string, number, string, string[], string, number, number,
    ];
    await Artwork.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          _id: id,
          creatorId,
          title,
          category,
          style,
          price,
          description,
          tags,
          imageUrl: `/artnest/${image}`,
          likes,
          views,
          saves: Math.round(likes * 0.36),
          status: "PUBLISHED",
          isDemo: true,
          createdAt: new Date(Date.now() - (index + 1) * 86400000),
        },
      },
      { upsert: true },
    );
  }

  await PortfolioProject.updateOne(
    { _id: "demo-portfolio-neon" },
    {
      $setOnInsert: {
        _id: "demo-portfolio-neon",
        creatorId: "riya",
        title: "Neon Mumbai — city after rain",
        description: "An image-led study of city light, monsoon weather, and everyday architecture.",
        imageUrl: "/artnest/art-neon-mumbai.jpg",
        skills: ["Digital painting", "Colour studies", "Storytelling"],
        links: [],
      },
    },
    { upsert: true },
  );

  await Collaboration.updateOne(
    { _id: "demo-collab-city-zine" },
    {
      $setOnInsert: {
        _id: "demo-collab-city-zine",
        creatorId: "kavya",
        title: "Illustrators for a student city zine",
        description: "Looking for two artists to make a small collaborative publication about the places we call home.",
        skillsRequired: ["Illustration", "Editorial design", "Writing"],
        status: "OPEN",
      },
    },
    { upsert: true },
  );

  await Commission.updateOne(
    { _id: "demo-commission-cover" },
    {
      $setOnInsert: {
        _id: "demo-commission-cover",
        buyerId: "demo-buyer",
        creatorId: "riya",
        title: "A cover illustration for a student zine",
        description: "A warm, rainy city scene with room for a title.",
        budget: 3000,
        deadline: new Date(Date.now() + 14 * 86400000),
        status: "PENDING",
      },
    },
    { upsert: true },
  );

  await Conversation.updateOne(
    { _id: "demo-conversation", participantKey: "demo-buyer|riya" },
    {
      $setOnInsert: {
        _id: "demo-conversation",
        participantIds: ["demo-buyer", "riya"],
        participantKey: "demo-buyer|riya",
        lastMessage: "Would you be open to a custom colour palette?",
        lastMessageAt: new Date(),
      },
    },
    { upsert: true },
  );
  await Message.updateOne(
    { _id: "demo-message-1" },
    {
      $setOnInsert: {
        _id: "demo-message-1",
        conversationId: "demo-conversation",
        senderId: "demo-buyer",
        receiverId: "riya",
        message: "Hi Riya, I came across Neon Mumbai and love the atmosphere.",
        createdAt: new Date(Date.now() - 3600000),
      },
    },
    { upsert: true },
  );
  await Message.updateOne(
    { _id: "demo-message-2" },
    {
      $setOnInsert: {
        _id: "demo-message-2",
        conversationId: "demo-conversation",
        senderId: "riya",
        receiverId: "demo-buyer",
        message: "Thank you! I spent a while trying to get the rain just right.",
        createdAt: new Date(Date.now() - 1800000),
      },
    },
    { upsert: true },
  );

  await Notification.updateOne(
    { _id: "demo-note-riya" },
    {
      $setOnInsert: {
        _id: "demo-note-riya",
        userId: "riya",
        type: "commission",
        title: "A commission request arrived",
        message: "Aarav requested a cover illustration.",
        read: false,
      },
    },
    { upsert: true },
  );

  await Order.updateOne(
    { _id: "AN-DEMO-10001" },
    {
      $setOnInsert: {
        _id: "AN-DEMO-10001",
        buyerId: "demo-buyer",
        items: [
          {
            artworkId: "monsoon-dreams",
            creatorId: "mira",
            title: "Monsoon Dreams",
            imageUrl: "/artnest/art-monsoon.jpg",
            quantity: 1,
            unitPrice: 850,
          },
        ],
        subtotal: 850,
        platformFee: 38,
        amount: 888,
        paymentProvider: "demo",
        paymentStatus: "SIMULATED",
        orderStatus: "COMPLETED",
        isDemo: true,
      },
    },
    { upsert: true },
  );

  await Review.updateOne(
    { _id: "demo-review-monsoon" },
    {
      $setOnInsert: {
        _id: "demo-review-monsoon",
        orderId: "AN-DEMO-10001",
        buyerId: "demo-buyer",
        artworkId: "monsoon-dreams",
        creatorId: "mira",
        rating: 5,
        comment: "A beautiful, thoughtful piece. The colours feel just like a rainy evening.",
      },
    },
    { upsert: true },
  );
}
