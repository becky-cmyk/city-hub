import LivingInNeighborhood from "./living-in-neighborhood";

const SOUTH_END = {
  name: "South End",
  slug: "living-in-south-end-charlotte",
  hubCode: "southend",
  metaTitle: "Living in South End Charlotte - Neighborhood Guide | CLT Hub",
  metaDescription: "Everything you need to know about living in South End, Charlotte NC. Apartments, restaurants, breweries, Rail Trail access, and the active urban lifestyle.",
  keywords: "living in south end charlotte, south end charlotte apartments, south end charlotte restaurants, south end rail trail, south end charlotte nc",
  intro: "South End is one of Charlotte's fastest-growing and most sought-after neighborhoods. Located just south of Uptown along the Lynx Blue Line light rail, South End has transformed into a vibrant urban district known for its walkability, dining scene, and young professional culture.",
  lifestyle: "South End offers one of the most active urban lifestyles in Charlotte. The neighborhood is centered around the Rail Trail, a multi-use path that connects residents to breweries, restaurants, fitness studios, and shops. Weekend afternoons often feature outdoor markets, live music at local venues, and packed restaurant patios. The area's density and walkability make it feel more like a big-city neighborhood than a typical Southern suburb. Many residents commute via the light rail or bike along the greenway.",
  housing: "Housing in South End is predominantly apartments and condos, ranging from modern high-rises to renovated industrial lofts. Rent for a one-bedroom apartment typically ranges from $1,400 to $2,200. New luxury developments continue to open, though more affordable options exist along the southern stretch of the corridor. Townhomes are available in adjacent areas like Dilworth and Sedgefield.",
  dining: "South End has one of the densest concentrations of restaurants and breweries in Charlotte. The neighborhood is home to dozens of dining options spanning craft breweries, rooftop bars, coffee shops, brunch spots, and international cuisine. The food hall concept has also thrived here, with multiple options for quick-service dining.",
  community: "South End hosts regular community events including the South End Gallery Crawl, seasonal markets, fitness events, and food truck rallies. The neighborhood has a strong social energy, making it easy for newcomers to connect. Many of the local businesses participate in neighborhood-wide promotions and events throughout the year.",
  transportation: "South End is one of the most transit-friendly neighborhoods in Charlotte. The Lynx Blue Line has multiple stops along South Boulevard, connecting residents to Uptown in minutes. The Rail Trail provides a dedicated bike and pedestrian corridor. Street parking is limited, but most apartment buildings include parking. The light rail makes it possible to live in South End without relying heavily on a car.",
  idealFor: [
    "Young professionals seeking an active, walkable urban lifestyle",
    "Remote workers who want to be near coffee shops, co-working spaces, and restaurants",
    "Newcomers to Charlotte who want to meet people quickly",
    "Anyone who values transit access and wants to minimize car dependence",
  ],
  faqs: [
    { q: "Is South End Charlotte a good place to live?", a: "Yes, South End is one of Charlotte's most popular neighborhoods, especially for young professionals. It offers walkability, excellent dining, light rail access, and a vibrant social scene." },
    { q: "How much is rent in South End Charlotte?", a: "One-bedroom apartments in South End typically range from $1,400 to $2,200 per month, depending on the building and amenities. Luxury units can be higher." },
    { q: "Is South End safe?", a: "South End is generally considered safe and well-populated. The neighborhood's walkability and active street life contribute to a strong sense of community safety." },
    { q: "What is the Rail Trail in South End?", a: "The Rail Trail is a multi-use path running through South End along the light rail corridor. It connects restaurants, breweries, parks, and shops, serving as the neighborhood's central artery for walking and biking." },
  ],
};

const NODA = {
  name: "NoDa",
  slug: "living-in-noda-charlotte",
  hubCode: "noda",
  metaTitle: "Living in NoDa Charlotte - Arts District Guide | CLT Hub",
  metaDescription: "Explore living in NoDa (North Davidson), Charlotte's arts district. Galleries, live music, creative culture, and independent restaurants.",
  keywords: "living in noda charlotte, noda arts district, noda charlotte apartments, north davidson charlotte, noda charlotte nc",
  intro: "NoDa, short for North Davidson, is Charlotte's original arts district. Known for its colorful murals, independent galleries, live music venues, and eclectic restaurants, NoDa attracts residents who value creative culture and community-driven events.",
  lifestyle: "NoDa has a laid-back, creative energy that sets it apart from other Charlotte neighborhoods. The streets are lined with galleries, music venues, tattoo shops, vintage stores, and independent restaurants. The neighborhood hosts regular art walks, open mic nights, and community gatherings. NoDa feels like a small creative village within a growing city. The Lynx Blue Line's 36th Street station connects NoDa to the rest of Charlotte, adding transit convenience to its artistic charm.",
  housing: "NoDa offers a mix of historic bungalows, renovated apartments, and newer condos. Housing prices are generally more affordable than South End, though gentrification has pushed prices up in recent years. One-bedroom rentals typically range from $1,200 to $1,700. Some residents find homes in the adjacent neighborhoods of Villa Heights and Optimist Park, which share NoDa's creative spirit at slightly lower price points.",
  dining: "NoDa's dining scene is independent and eclectic. The neighborhood is known for its food trucks, craft coffee shops, breweries, and locally owned restaurants. Several spots have become Charlotte institutions, drawing visitors from across the city for brunch, live music dinners, and late-night gatherings.",
  community: "NoDa has one of the strongest community identities in Charlotte. The NoDa Neighborhood Association is active, and residents regularly participate in gallery crawls, neighborhood clean-ups, and seasonal festivals. The annual NoDa Brewing Anniversary and gallery walk events are neighborhood traditions that bring together artists, business owners, and residents.",
  transportation: "NoDa is accessible via the Lynx Blue Line at the 36th Street station, connecting residents to Uptown, South End, and UNC Charlotte. The neighborhood is also bikeable and walkable for local errands and dining. Street parking is available but can be limited during events. Interstate 277 and I-77 provide quick access to other parts of the metro.",
  idealFor: [
    "Artists, musicians, and creative professionals",
    "People who value independent local businesses over chains",
    "Young professionals who prefer a relaxed, community-oriented neighborhood",
    "Anyone who enjoys live music, galleries, and cultural events",
  ],
  faqs: [
    { q: "What does NoDa stand for?", a: "NoDa stands for North Davidson, named after North Davidson Street, the main corridor through the neighborhood." },
    { q: "Is NoDa a good neighborhood in Charlotte?", a: "Yes, NoDa is one of Charlotte's most beloved neighborhoods, known for its arts scene, independent businesses, and strong community identity. It appeals to creative professionals and anyone seeking an eclectic, walkable neighborhood." },
    { q: "How much does it cost to live in NoDa?", a: "One-bedroom apartments in NoDa typically range from $1,200 to $1,700. Historic homes and newer condos vary widely in price depending on size and renovation level." },
  ],
};

const PLAZA_MIDWOOD = {
  name: "Plaza Midwood",
  slug: "living-in-plaza-midwood",
  hubCode: "plazamidwood",
  metaTitle: "Living in Plaza Midwood Charlotte - Neighborhood Guide | CLT Hub",
  metaDescription: "Guide to living in Plaza Midwood, Charlotte NC. Historic homes, local shops, restaurants, nightlife, and eclectic neighborhood culture.",
  keywords: "living in plaza midwood charlotte, plaza midwood homes, plaza midwood restaurants, plaza midwood charlotte nc, plaza midwood nightlife",
  intro: "Plaza Midwood is one of Charlotte's most eclectic and character-rich neighborhoods. Located just east of Uptown, it blends historic homes with a thriving local business district, making it a favorite among long-time Charlotte residents and newcomers alike.",
  lifestyle: "Plaza Midwood has a distinctive identity that blends old Charlotte charm with modern urban culture. The main commercial strip along Central Avenue features independent restaurants, vintage shops, dive bars, and specialty stores. The neighborhood is known for its walkable main street feel, diverse dining options, and active nightlife. Many residents are drawn to Plaza Midwood because it feels authentic — less polished than South End but full of personality.",
  housing: "Plaza Midwood features a mix of 1920s-1940s bungalows, mid-century ranch homes, and newer infill townhomes. Home prices have risen significantly as the neighborhood has gained popularity, but it still offers more variety than many Charlotte neighborhoods. Rental options include apartments in small complexes and converted homes. One-bedroom rentals range from $1,100 to $1,600.",
  dining: "Plaza Midwood's dining scene is diverse and independent. The neighborhood is known for international cuisine, neighborhood bars, coffee shops, and brunch spots. Central Avenue has become one of Charlotte's most celebrated food corridors, with options spanning Latin American, Asian, Mediterranean, and Southern comfort food.",
  community: "Plaza Midwood has an active neighborhood association and a strong sense of local identity. Residents gather for events like the annual Plaza Midwood Festival, holiday markets, and community yard sales. The neighborhood's diversity — in both demographics and business types — creates a welcoming environment for people from all backgrounds.",
  transportation: "Plaza Midwood is located about 10 minutes east of Uptown Charlotte by car. While there is no direct light rail access, CATS bus routes serve the area. The neighborhood is bikeable for local trips, and the greenway system connects to nearby areas. Many residents commute by car, with easy access to Independence Boulevard and I-277.",
  idealFor: [
    "People who value neighborhood character and independent businesses",
    "Foodies who enjoy exploring diverse restaurant scenes",
    "Homebuyers looking for historic charm with urban convenience",
    "Anyone who prefers a neighborhood with personality over polish",
  ],
  faqs: [
    { q: "Is Plaza Midwood a good place to live in Charlotte?", a: "Yes, Plaza Midwood is consistently rated as one of Charlotte's best neighborhoods for its walkable main street, diverse dining, historic homes, and strong community feel." },
    { q: "What is Plaza Midwood known for?", a: "Plaza Midwood is known for its eclectic character, independent restaurants and shops along Central Avenue, historic bungalow homes, and active nightlife and community events." },
    { q: "How much are homes in Plaza Midwood?", a: "Home prices in Plaza Midwood vary widely, from around $300,000 for smaller bungalows to $600,000+ for renovated historic homes. The neighborhood has seen significant appreciation in recent years." },
  ],
};

const DILWORTH = {
  name: "Dilworth",
  slug: "living-in-dilworth-charlotte",
  hubCode: "dilworth",
  metaTitle: "Living in Dilworth Charlotte - Historic Neighborhood Guide | CLT Hub",
  metaDescription: "Guide to living in Dilworth, one of Charlotte's oldest and most desirable neighborhoods. Historic homes, tree-lined streets, Latta Park, and proximity to Uptown.",
  keywords: "living in dilworth charlotte, dilworth charlotte homes, dilworth charlotte nc, dilworth neighborhood, dilworth latta park",
  intro: "Dilworth is one of Charlotte's oldest and most established neighborhoods, known for its tree-lined streets, historic homes, and walkable proximity to both Uptown and South End. It has long been one of the most desirable addresses in the city.",
  lifestyle: "Dilworth offers a refined, family-friendly lifestyle with urban convenience. The neighborhood centers around East Boulevard and Kenilworth Avenue, where residents find locally owned restaurants, boutiques, and coffee shops. Latta Park provides green space for jogging, dog walking, and community events. The neighborhood has a mature, established feel — less trendy than South End but deeply rooted in Charlotte's history.",
  housing: "Dilworth features some of Charlotte's most beautiful historic homes, including Craftsman bungalows, Tudor revivals, and Colonial-style houses built in the early 1900s. Home prices range from $400,000 for smaller homes to well over $1 million for larger restored properties. Condos and apartments are also available, particularly along East Boulevard. Rentals for one-bedrooms range from $1,300 to $1,800.",
  dining: "Dilworth's dining scene is upscale-casual with a neighborhood feel. East Boulevard features a mix of brunch spots, wine bars, and chef-driven restaurants. The neighborhood is known for its walkable restaurant row, where residents can move between multiple dining options on foot.",
  community: "Dilworth has one of the most active neighborhood associations in Charlotte, hosting events like the Dilworth Jubilee, home tours, and seasonal celebrations. The community takes pride in preserving the neighborhood's historic character while welcoming new residents and businesses.",
  transportation: "Dilworth is located immediately south of Uptown Charlotte, making it one of the closest residential neighborhoods to the city center. Many residents walk or bike to Uptown. The Lynx Blue Line's East/West station is nearby, and bus routes serve East Boulevard. Street parking is available throughout the neighborhood.",
  idealFor: [
    "Families seeking a walkable neighborhood with excellent character",
    "Professionals who want to live close to Uptown without living downtown",
    "Homebuyers interested in historic architecture and established neighborhoods",
    "Dog owners who value nearby parks and walkable streets",
  ],
  faqs: [
    { q: "Is Dilworth a good neighborhood in Charlotte?", a: "Dilworth is widely considered one of Charlotte's best neighborhoods. Its historic homes, tree-lined streets, walkability to Uptown, and active community make it highly desirable for families and professionals." },
    { q: "How much do homes cost in Dilworth Charlotte?", a: "Homes in Dilworth range from around $400,000 for smaller properties to over $1 million for fully restored historic homes. The neighborhood commands premium prices due to its location and character." },
    { q: "What is Latta Park?", a: "Latta Park is Dilworth's central green space, featuring walking paths, a playground, sports courts, and open fields. It hosts community events and is a popular gathering spot for residents." },
  ],
};

const BALLANTYNE = {
  name: "Ballantyne",
  slug: "living-in-ballantyne",
  hubCode: "ballantyne",
  metaTitle: "Living in Ballantyne Charlotte - Suburban Community Guide | CLT Hub",
  metaDescription: "Guide to living in Ballantyne, south Charlotte. Corporate campuses, family-friendly communities, golf, shopping, and modern suburban lifestyle.",
  keywords: "living in ballantyne charlotte, ballantyne nc, ballantyne homes, ballantyne charlotte families, ballantyne corporate center",
  intro: "Ballantyne is a master-planned community in south Charlotte known for its corporate campuses, family-friendly neighborhoods, golf courses, and modern amenities. It attracts professionals and families who want suburban living with urban conveniences.",
  lifestyle: "Ballantyne offers a polished suburban lifestyle with everything within reach. The Ballantyne area features shopping centers, fitness facilities, golf courses, parks, and a growing restaurant scene. Many residents work in the nearby corporate campuses for major employers. The community feels newer and more manicured than Charlotte's urban neighborhoods, with wide streets, HOA-maintained common areas, and well-planned developments.",
  housing: "Ballantyne offers a wide range of housing from apartments and townhomes to single-family homes in planned communities. Home prices range from $350,000 for townhomes to $800,000+ for larger single-family homes. The area has seen continuous new construction, so many homes are modern and move-in ready. Rental apartments range from $1,200 to $1,800 for one-bedrooms.",
  dining: "Ballantyne's dining scene has grown significantly, with options ranging from casual family restaurants to upscale steakhouses. The Ballantyne Village shopping area features a concentration of dining and retail. While the scene is newer than urban Charlotte neighborhoods, quality options continue to emerge.",
  community: "Ballantyne has an active family community with youth sports leagues, community pools, neighborhood events, and excellent schools. The Ballantyne Country Club and resort provide additional social and recreational opportunities. Many families appreciate the area's safety, cleanliness, and family-oriented programming.",
  transportation: "Ballantyne is located along the I-485 beltway in south Charlotte, providing easy highway access to other parts of the metro. There is no light rail service currently, though future transit expansion has been discussed. Most residents rely on cars, and commutes to Uptown typically take 25-35 minutes depending on traffic. The area has ample parking.",
  idealFor: [
    "Families with children who value good schools and safe neighborhoods",
    "Corporate professionals working at south Charlotte campuses",
    "People relocating from other cities who prefer suburban familiarity",
    "Golfers and fitness enthusiasts who want resort-style amenities",
  ],
  faqs: [
    { q: "Is Ballantyne a good place to live?", a: "Ballantyne is one of south Charlotte's most popular communities, especially for families. It offers modern amenities, good schools, corporate proximity, and a clean, well-planned environment." },
    { q: "How far is Ballantyne from Uptown Charlotte?", a: "Ballantyne is approximately 15 miles south of Uptown Charlotte. The commute takes 25-35 minutes by car depending on traffic conditions." },
    { q: "What are home prices in Ballantyne?", a: "Homes in Ballantyne range from $350,000 for townhomes to $800,000+ for larger single-family homes. New construction is common, and the area continues to develop." },
  ],
};

const MATTHEWS = {
  name: "Matthews",
  slug: "living-in-matthews-nc",
  hubCode: "matthews",
  metaTitle: "Living in Matthews NC - Charlotte Suburb Guide | CLT Hub",
  metaDescription: "Guide to living in Matthews, NC near Charlotte. Small-town charm, family-friendly community, downtown shops, parks, and strong schools.",
  keywords: "living in matthews nc, matthews nc homes, matthews charlotte suburb, matthews nc schools, matthews nc downtown",
  intro: "Matthews is a charming town located just southeast of Charlotte that has maintained its small-town identity while benefiting from the growth of the Charlotte metro. It consistently ranks among the best suburbs in the region for families.",
  lifestyle: "Matthews offers a small-town lifestyle with big-city proximity. The historic downtown area features locally owned shops, restaurants, and a farmers market. Stumptown Park and nearby greenways provide outdoor recreation. Despite being surrounded by Charlotte's suburban growth, Matthews has preserved its walkable downtown core and community-oriented culture.",
  housing: "Matthews offers diverse housing options including established single-family neighborhoods, newer developments, townhomes, and apartments. Home prices range from $300,000 to $600,000 for single-family homes, with some newer luxury builds higher. The town attracts families looking for more space and value compared to Charlotte's inner neighborhoods.",
  dining: "Downtown Matthews has a growing collection of locally owned restaurants, cafes, and bakeries. The surrounding area includes a mix of independent eateries and well-known chains. The Matthews Community Farmers Market is one of the most popular in the region.",
  community: "Matthews has a strong community identity with regular events including the Matthews Alive Festival, holiday celebrations, and farmers market weekends. The town's parks and recreation department offers programming for all ages. Residents often cite the town's community feel as a primary reason for moving there.",
  transportation: "Matthews is located along Independence Boulevard (US-74) and near I-485, providing highway access to Charlotte and surrounding areas. The commute to Uptown Charlotte takes about 20-30 minutes. CATS bus service connects Matthews to the broader transit system. Most residents rely on personal vehicles.",
  idealFor: [
    "Families seeking strong schools and a safe community",
    "People who prefer small-town charm within reach of a major city",
    "Homebuyers looking for more space and value than inner Charlotte",
    "Anyone who values community events and local business culture",
  ],
  faqs: [
    { q: "Is Matthews NC a good place to live?", a: "Yes, Matthews consistently ranks among the best suburbs in the Charlotte metro. It offers excellent schools, a charming downtown, community events, and family-friendly neighborhoods at reasonable prices." },
    { q: "How far is Matthews from Charlotte?", a: "Matthews is about 12 miles southeast of Uptown Charlotte. The commute takes approximately 20-30 minutes depending on traffic." },
    { q: "What are home prices in Matthews NC?", a: "Single-family homes in Matthews typically range from $300,000 to $600,000. The town offers good value compared to many Charlotte neighborhoods closer to Uptown." },
  ],
};

const HUNTERSVILLE = {
  name: "Huntersville",
  slug: "living-in-huntersville-nc",
  hubCode: "huntersville",
  metaTitle: "Living in Huntersville NC - Lake Norman Area Guide | CLT Hub",
  metaDescription: "Guide to living in Huntersville, NC near Lake Norman. Family communities, shopping, outdoor recreation, and easy access to Charlotte.",
  keywords: "living in huntersville nc, huntersville charlotte, huntersville homes, huntersville nc schools, lake norman huntersville",
  intro: "Huntersville is a fast-growing town north of Charlotte, positioned between Uptown and Lake Norman. It combines suburban family living with outdoor recreation access, making it a top choice for families and professionals who want space without sacrificing convenience.",
  lifestyle: "Huntersville offers a suburban lifestyle with excellent outdoor recreation nearby. Lake Norman is just minutes north, providing boating, fishing, and waterfront dining. The town has developed a strong retail and dining presence along the I-77 corridor, including Birkdale Village, a walkable mixed-use center. Parks, greenways, and sports facilities provide active lifestyle options year-round.",
  housing: "Huntersville has experienced significant residential growth with new communities, established neighborhoods, and townhome developments. Home prices range from $325,000 to $650,000 for single-family homes. The town offers newer construction and more space per dollar than many Charlotte neighborhoods. Apartment rentals range from $1,100 to $1,600.",
  dining: "Huntersville's dining has expanded with Birkdale Village serving as a hub for restaurants, shops, and entertainment. The town offers a mix of local restaurants, national chains, and specialty food spots. The proximity to Lake Norman adds waterfront dining options in nearby Cornelius and Davidson.",
  community: "Huntersville has a strong family community with youth sports leagues, community pools, holiday events, and an active parks and recreation department. The town balances growth with community programming, and many neighborhoods have active HOAs that organize social events.",
  transportation: "Huntersville is located along I-77, about 15 miles north of Uptown Charlotte. The commute takes 20-35 minutes depending on traffic. I-77 toll lanes (Express Lanes) provide a faster option for commuters. There is no light rail service, though bus routes connect to the broader CATS system. Most residents rely on cars.",
  idealFor: [
    "Families seeking newer homes, good schools, and outdoor recreation",
    "Lake Norman enthusiasts who want quick access to the water",
    "Professionals commuting to north Charlotte or Uptown",
    "People relocating who want suburban space at reasonable prices",
  ],
  faqs: [
    { q: "Is Huntersville NC a good place to live?", a: "Huntersville is one of the most popular suburbs in the Charlotte metro, offering strong schools, family-friendly communities, proximity to Lake Norman, and growing retail and dining options." },
    { q: "How far is Huntersville from Charlotte?", a: "Huntersville is approximately 15 miles north of Uptown Charlotte. The commute takes 20-35 minutes by car, with express toll lanes available on I-77." },
    { q: "What is Birkdale Village?", a: "Birkdale Village is Huntersville's premier mixed-use center featuring walkable shops, restaurants, a movie theater, and community events. It serves as the town's social hub." },
  ],
};

const CORNELIUS = {
  name: "Cornelius",
  slug: "living-in-cornelius-nc",
  hubCode: "cornelius",
  metaTitle: "Living in Cornelius NC - Lake Norman Community Guide | CLT Hub",
  metaDescription: "Guide to living in Cornelius, NC on Lake Norman. Waterfront living, family communities, dining, and easy access to Charlotte.",
  keywords: "living in cornelius nc, cornelius lake norman, cornelius charlotte, cornelius nc homes, cornelius nc restaurants",
  intro: "Cornelius is a lakefront town on the southern shore of Lake Norman, offering residents a unique blend of waterfront living, small-town charm, and proximity to Charlotte. It has become one of the most desirable communities in the Lake Norman region.",
  lifestyle: "Cornelius offers a relaxed lakeside lifestyle with convenient access to Charlotte. Residents enjoy waterfront parks, boat launches, and lake activities during warmer months. The town's main corridor along West Catawba and Highway 21 features restaurants, shops, and services. Cornelius feels more established and quieter than neighboring Huntersville, with a stronger connection to the lake.",
  housing: "Cornelius offers everything from lakefront estates to family-friendly subdivisions and modern townhomes. Lakefront properties can command premium prices ($600,000 to $2M+), while non-waterfront homes range from $350,000 to $700,000. The town has a mix of established neighborhoods and newer developments. Apartment options are growing but more limited than in Charlotte proper.",
  dining: "Cornelius has a growing dining scene with waterfront restaurants, local gastropubs, coffee shops, and international cuisine. The town benefits from its proximity to Davidson's dining scene to the north and Huntersville's Birkdale Village to the south.",
  community: "Cornelius has an active town government that hosts community events, concerts in the park, holiday celebrations, and farmers markets. The town is family-oriented with excellent parks, a community fitness center, and organized recreational programs. Many residents are involved in lake-related organizations and environmental stewardship.",
  transportation: "Cornelius is located along I-77, approximately 20 miles north of Uptown Charlotte. The commute takes 25-40 minutes depending on traffic. I-77 Express Lanes provide a faster commute option. The town is walkable in its core areas but most residents rely on cars for daily commuting. CATS bus service provides limited connections.",
  idealFor: [
    "Families and retirees who want lake access and a quieter pace",
    "Professionals willing to commute for a higher quality of life",
    "Boating, fishing, and outdoor recreation enthusiasts",
    "People seeking a tight-knit community with excellent schools",
  ],
  faqs: [
    { q: "Is Cornelius NC a good place to live?", a: "Cornelius is widely regarded as one of the best communities in the Lake Norman area. It offers waterfront living, excellent schools, a growing dining scene, and a strong sense of community." },
    { q: "How far is Cornelius from Charlotte?", a: "Cornelius is approximately 20 miles north of Uptown Charlotte. The commute takes 25-40 minutes by car, with express toll lanes available on I-77 for faster travel." },
    { q: "Can you live on Lake Norman in Cornelius?", a: "Yes, Cornelius has waterfront properties on Lake Norman ranging from $600,000 to over $2 million. Non-waterfront homes with lake access through community amenities are also available at lower price points." },
  ],
};

export function LivingInSouthEnd() { return <LivingInNeighborhood config={SOUTH_END} />; }
export function LivingInNoDa() { return <LivingInNeighborhood config={NODA} />; }
export function LivingInPlazaMidwood() { return <LivingInNeighborhood config={PLAZA_MIDWOOD} />; }
export function LivingInDilworth() { return <LivingInNeighborhood config={DILWORTH} />; }
export function LivingInBallantyne() { return <LivingInNeighborhood config={BALLANTYNE} />; }
export function LivingInMatthews() { return <LivingInNeighborhood config={MATTHEWS} />; }
export function LivingInHuntersville() { return <LivingInNeighborhood config={HUNTERSVILLE} />; }
export function LivingInCornelius() { return <LivingInNeighborhood config={CORNELIUS} />; }
