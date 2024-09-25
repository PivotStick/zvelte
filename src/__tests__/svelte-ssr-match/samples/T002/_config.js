import conf from "../../conf.js";

export default conf({
    props: {
        data: {
            socials: [
                {
                    id: "youtube",
                    name: "YouTube",
                    icon: "fa-youtube",
                    href: "https://www.youtube.com/@nanopolis",
                },
                {
                    id: "instagram",
                    name: "Instagram",
                    icon: "fa-instagram",
                    href: "https://www.instagram.com/nanopol.is/",
                },
                {
                    id: "facebook",
                    name: "Facebook",
                    icon: "fa-facebook-f",
                    href: "https://www.facebook.com/nanopolismusic",
                },
                {
                    id: "discord",
                    name: "Discord",
                    icon: "fa-discord",
                    href: "https://www.discord.com",
                },
            ],
        },
    },
});
